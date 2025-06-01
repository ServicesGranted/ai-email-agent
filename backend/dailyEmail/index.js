const { Client } = require('@microsoft/microsoft-graph-client');
const sgMail = require('@sendgrid/mail');
const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient('user-context');

  try {
    const client = Client.init({
      authProvider: async (done) => {
        done(null, 'your_access_token');
      }
    });

    const userId = 'your_user_id';
    const blobClient = containerClient.getBlockBlobClient(`${userId}.json`);
    let context = { priorities: '' };
    try {
      const download = await blobClient.download();
      context = JSON.parse((await streamToBuffer(download.content)).toString());
    } catch (err) {
      console.log('No context found');
    }

    const events = await client.api('/me/calendarView')
      .query({
        startDateTime: new Date().toISOString(),
        endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .top(50)
      .get();

    const emailFilter = context.priorities.includes('urgent') ? 'importance eq \'high\'' : '';
    const emails = await client.api('/me/messages')
      .filter(emailFilter)
      .top(10)
      .get();

    const priorityList = [
      ...events.value.map(event => ({
        type: 'event',
        priority: new Date(event.start.dateTime) < new Date(Date.now() + 24 * 60 * 60 * 1000) ? 1 : 2,
        text: `${event.subject} (<a href="outlook://calendar/${event.id}">Add to Calendar</a>, ${new Date(event.start.dateTime).toLocaleString()})`
      })),
      ...emails.value.map(email => ({
        type: 'email',
        priority: email.importance === 'high' ? 1 : 2,
        text: `Email from ${email.from.emailAddress.name}: ${email.subject}`
      }))
    ].sort((a, b) => a.priority - b.priority || new Date(a.text) - new Date(b.text));

    const msg = {
      to: 'user@example.com',
      from: 'ai-agent@example.com',
      subject: 'Your Weekly Agenda',
      html: `<h2>Your Weekly Agenda</h2><ul style="font-family: Arial; color: #333;">${priorityList.map(item => `<li>${item.text} (${item.type})</li>`).join('')}</ul>`
    };

    await sgMail.send(msg);
    context.log('Daily email sent');
  } catch (err) {
    context.log.error('Failed to send daily email:', err);
  }
};

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}