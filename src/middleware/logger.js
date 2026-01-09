const logger = (req, res, next) => {
  const start = Date.now();

  const originalSend = res.send;
  res.send = function (body) {
    res.send = originalSend;
    res.send(body);

    try {
      const duration = Date.now() - start;
      const metadata = {
        method: req.method,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        body: req.body
      };

      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, metadata);
    } catch (err) {
      console.error('Logger error:', err);
    }
  };

  next();
};

module.exports = logger;