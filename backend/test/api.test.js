const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../index');

chai.use(chaiHttp);
const expect = chai.expect;

describe('API', () => {
  it('should return 200 for context GET', (done) => {
    chai.request(app)
      .get('/api/context')
      .set('Authorization', 'Bearer mock_token')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('personalDetails');
        done();
      });
  });
});