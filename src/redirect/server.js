const express = require('express');
const base64url = require('base64url');
const crypto = require('crypto');
const { PORT, PUBLIC_URL } = require('./config');
const logger = require('./logger');
const fs = require('fs');
const fetch = require('node-fetch');

// create express app
const app = express();
app.use(express.json());
const server = app.listen(PORT, () => {
  logger.info(`App listening at http://localhost:${PORT}`);
});

/**
 * Creates random Id for QR code data that is POSTed to the server.
 * @returns base 64 url encoded Id
 */
const randomId = () => base64url.encode(crypto.randomBytes(32));

const QRs = new Map();

/*
POST QR data to server.

If there is more than one file to share, server creates a Sharing Manifest JSON file with
array of high-entropy shared file URLS.

Generates JSON payload (returned as the response) containing a URL for the authorization server.
The QR will be constructed from this JSON QR payload.
*/
app.post('/qr', async (req, res) => {
  logger.info('Sending POST request to /qr');
  const qrId = randomId();
  // set mapping of ID to object containing QR details
  QRs.set(qrId, {
    id: qrId,
    request: req.body,
    claims: []
  });

  // generate and return url for the authorization server
  res.json({
    url: `${PUBLIC_URL}/qr/${qrId}/claim`
  });
});

/*
POST to .url property of the JSON payload to redeem shclink.

If the request is valid, server redirects to the 'clientSpecificUrl' path with a 
301 Moved Permanently status. This sends a GET request to /qr/[qr ID]/claimed/[claimed ID]
*/
app.post('/qr/:id/claim', (req, res) => {
  const qrId = req.params.id;
  logger.info(`Sending POST request to /qr/${qrId}/claim`);
  // Get QR details using given QR id
  const policy = QRs.get(qrId);

  if (!policy || policy.claims.length >= (policy.request.claimsLimit || Infinity)) {
    res.status(403);
    return res.send(`QR ${qrId} is not valid or has already been claimed`);
  }

  const clientSpecificUrl = `/qr/${qrId}/claimed/${randomId()}`;

  // create new claim
  policy.claims.push({
    clientName: req.query.clientName || 'unknown',
    clientSpecificUrl,
    queryLog: [`Claimed: ${new Date()}`],
    locationAlias: Object.fromEntries(
      Array.from(new Set(policy.request.access.flatMap(a => a.locations || [])).values()).map(l => [l, randomId()])
    )
  });

  // redirect to 301 Moved Permanently if redemption is successful
  res.redirect(301, clientSpecificUrl);
});

/*
GET to clientSpecificURL for SHCLink that was claimed.

Allows client to access location where SHCLink file/Sharing Manifest is exposed.
*/
app.get('/qr/:id/claimed/:cid', (req, res) => {
  const { cid, id } = req.params;
  logger.info(`Sending GET request to /qr/${id}/claimed/${cid}`);
  const policy = QRs.get(id);

  if (!policy) {
    res.status(403);
    return res.send(`QR ${id} is no longer valid`);
  }

  const claimDetails = policy.claims.find(c => c.clientSpecificUrl === req.url);
  if (!claimDetails) {
    res.status(403);
    return res.send('This QR has not been correctly claimed');
  }

  res.json(
    policy.request.access.map(a => ({
      ...a,
      locations: a.locations?.map(l => `${PUBLIC_URL}/qr/${id}/claimed/${cid}/files/${claimDetails.locationAlias[l]}`)
    }))
  );
});

/*
GET claimed file.
*/
app.get('/qr/:id/claimed/:cid/files/:fileid', async (req, res) => {
  const { id, cid, fileid } = req.params;
  logger.info(`Sending GET request to /qr/${id}/claimed/${cid}/files/${fileid}`);
  const policy = QRs.get(id);

  if (!policy) {
    res.status(403);
    return res.send(`QR ${id} is no longer valid`);
  }

  const claimDetails = policy.claims.find(c => c.clientSpecificUrl === `/qr/${id}/claimed/${cid}`);
  if (!claimDetails) {
    res.status(403);
    return res.send('This QR has not been correctly claimed');
  }

  const trueLocation = Object.entries(claimDetails.locationAlias).find(
    ([, clientSpecific]) => clientSpecific === fileid
  )[0];

  logger.debug(`trueLocation found for id ${id}`);

  const proxied = await fetch(trueLocation);
  res.status(proxied.status);
  res.header('Content-Type', proxied.headers.get('content-type') || 'application/text');
  res.send(await proxied.text());
});

/*
Used for testing functionality of above endpoints. Serves as fake
static file hosting for testing.
*/
app.get('/:file.json', async (req, res) => {
  const file = req.params.file;
  const filePath = `test/redirect/fixtures/${file}.json`;
  if (fs.existsSync(filePath)) {
    logger.debug(`file path ${filePath} exists`);
    const contents = fs.readFileSync(filePath);
    res.status(201);
    res.set('Content-Type', 'application/json');
    res.send(JSON.parse(contents));
  } else {
    logger.debug(`file path ${filePath} does not exist`);
    res.status(404).send(`The provided filepath ${filePath} does not exist.`);
  }
});

module.exports = { server };
