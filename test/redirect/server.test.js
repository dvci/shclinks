require('../../src/redirect/config');
const supertest = require('supertest');
const { server } = require('../../src/redirect/server');

const EXAMPLE_REQUEST_BODY = require('./fixtures/exampleRequestBody.json');
const INVALID_ID = 'INVALID_ID';
describe('test /qr endpoint', () => {
  test('POST request to /qr returns 200 status with claim url', async () => {
    await supertest(server)
      .post('/qr')
      .send(EXAMPLE_REQUEST_BODY)
      .expect(200)
      .then(response => {
        expect(response.body).toHaveProperty('url');
      });
  });

  afterAll(() => {
    server.close();
  });
});

describe('test /qr/[qr id]/claim endpoint', () => {
  test('POST request to /qr/[qr id]/claim returns 403 status for invalid/previously claimed QR', async () => {
    await supertest(server).post(`/qr/${INVALID_ID}/claim`).expect(403);
  });

  test('Valid POST request to /qr/[qr id]/claim returns 301 status', async () => {
    const qrResponse = await supertest(server).post('/qr').send(EXAMPLE_REQUEST_BODY).expect(200);
    await supertest(server)
      .post(qrResponse.body.url.replace('http://localhost:3000', ''))
      .expect(301)
      .then(response => {
        expect(response.header.location).toBeDefined();
      });
  });

  afterAll(() => {
    server.close();
  });
});

describe('test /qr/[qr id]/claimed/[claim id]/files/[file id] endpoint', () => {
  test('GET request to valid file location returns file content from /qr request', async () => {
    const qrResponse = await supertest(server).post('/qr').send(EXAMPLE_REQUEST_BODY).expect(200);
    const claimResponse = await supertest(server)
      .post(qrResponse.body.url.replace('http://localhost:3000', ''))
      .expect(301);
    await supertest(server)
      .get(claimResponse.header.location.replace('http://localhost:3000', ''))
      .expect(200)
      .then(response => {
        expect(JSON.parse(response.res.text)[0]).toHaveProperty('locations');
      });
  });

  afterAll(() => {
    server.close();
  });
});
