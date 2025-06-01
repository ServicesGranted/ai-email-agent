const express = require('express');
const { Client } = require('@microsoft/microsoft-graph-client');
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

const app = express();
app.use(express.json());

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient('user-context');

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

app.post('/api/prompt', async (req, res) => {
  const { prompt, context } = req.body;
  try {
    const client = Client.init({
      authProvider: (done) => done(null, req.headers.authorization.split(' ')[1])
    });

    let result = '';
    const lowerPrompt = prompt.toLowerCase();
    const contextString = `Context: Personal Details: ${context.personalDetails}, Priorities: ${context.priorities}, Notes: ${context.notes}`;

    if (lowerPrompt.includes('read') || (lowerPrompt.includes('show') && lowerPrompt.includes('email'))) {
      const sort = context.priorities.includes('urgent') ? 'importance' : lowerPrompt.includes('sender') ? 'from' : 'receivedDateTime';
      const emails = await client.api('/me/messages')
        .orderby(`${sort} desc`)
        .top(5)
        .get();
      result = emails.value.map(email => `From: ${email.from.emailAddress.name}, Subject: ${email.subject}`).join('\n');
    } else if (lowerPrompt.includes('respond') && lowerPrompt.includes('email')) {
      const emailId = 'your_email_id';
      const responseText = context.notes.includes('tree-cutting')
        ? `Hi, thanks for reaching out about our tree-cutting services! We offer tree removal, pruning, and stump grinding. Please let me know your needs.`
        : 'Thanks for your email!';
      await client.api(`/me/messages/${emailId}/reply`).post({ comment: responseText });
      result = 'Email response sent.';
    } else if (lowerPrompt.includes('add') && lowerPrompt.includes('event')) {
      await client.api('/me/events').post({
        subject: 'New Event',
        start: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
        end: { dateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' }
      });
      result = 'Event added to calendar.';
    } else if (lowerPrompt.includes('reminder')) {
      result = `Reminder set for ${context.reminderTiming} minutes before event.`;
    } else if (lowerPrompt.includes('show') && lowerPrompt.includes('event')) {
      const events = await client.api('/me/events')
        .filter(`start/dateTime ge '${new Date().toISOString()}'`)
        .top(5)
        .get();
      result = events.value.map(event => `${event.subject} (${new Date(event.start.dateTime).toLocaleString()})`).join('\n');
    } else {
      result = 'Sorry, I didn’t understand. Try "read emails," "respond to email," "add event," or "show reminders."';
    }

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process prompt' });
  }
});

app.get('/api/context', async (req, res) => {
  try {
    const userId = req.headers.authorization.split('.')[1];
    const blobClient = containerClient.getBlockBlobClient(`${userId}.json`);
    const download = await blobClient.download();
    const context = JSON.parse((await streamToBuffer(download.content)).toString());
    res.json(context);
  } catch (err) {
    res.json({ personalDetails: '', priorities: '', notes: '', reminderTiming: '15' });
  }
});

app.post('/api/context', async (req, res) => {
  try {
    const userId = req.headers.authorization.split('.')[1];
    const blobClient = containerClient.getBlockBlobClient(`${userId}.json`);
    await blobClient.upload(JSON.stringify(req.body), JSON.stringify(req.body).length);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save context' });
  }
});

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

app.listen(3001, () => console.log('Server running on port 3001'));

module.exports = app;