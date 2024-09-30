// Env
require('dotenv').config();

// Dependencies
const agent = require('superagent');
const app = require('express')();

// Node process overrides
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.use(function (req, res, next) {
  console.log(
    `[${new Date().toLocaleString()}] ${req.method}: ${req.originalUrl}`
  );

  next();
});

app.use(function (req, res, next) {
  var data = '';
  req.setEncoding('utf8');
  req.on('data', function (chunk) {
    data += chunk;
  });
  req.on('end', function () {
    req.body = data;
    next();
  });
});

const endpoint = process.env.JJ_IP + ':' + process.env.JJ_PORT;

app.all('*', function (request, response) {
  let urlAffix = request.originalUrl;
  if (urlAffix.includes('favicon.ico')) {
    response.status(404).send('Not found');
    return;
  }

  // Proxy the request to iliad.dev with original headers and body
  agent[request.method.toLowerCase()](`https://${endpoint}` + urlAffix) // Send the original URL to iliad.dev
    .buffer(true) // Buffer the response, necessary for non-text data like images
    .set({
      ...request.headers, // Forward the original request headers
      'x-iliad-proxy': 'Proxy server by Iliad.dev', // Add a custom header to the request
      // host: `${process.env.DESTINATION_DOMAIN}`, // Override the host header to iliad.dev
    })
    .send(request.body) // Forward the original request body if any
    .end((err, res) => {
      if (err) {
        console.error(err);

        response.setHeader('x-iliad-proxy', 'Proxy server by Iliad.dev'); // Add a custom header to the response

        // Forward error status code and message
        return response.status(err.status || 500).json({
          err,
        });
      }

      console.log('response', res);

      // Handle different types of content, including binary data like images
      // if (res.headers['content-type']) {
      //   response.set('Content-Type', res.headers['content-type']); // Set the correct content type
      // }

      // if (res.headers['content-length']) {
      //   response.set('Content-Length', res.headers['content-length']); // Set the content length for proper transfer
      // }

      for (const [key, value] of Object.entries(res.headers)) {
        response.set(key, value); // Forward all the headers from the response
      }

      response.set('x-iliad-proxy', `Proxy server by Iliad.dev`); // Add a custom header to the response

      // Serve binary content as buffer
      if (res.body && Buffer.isBuffer(res.body)) {
        response.status(res.statusCode).send(res.body); // Send binary data like images, CSS, JS, etc.
      } else {
        // Handle text (HTML, CSS, JS, etc.)
        response.status(res.statusCode).send(res.text); // Send text-based content
      }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
