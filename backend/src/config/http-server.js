export function configureHttpServer(server) {
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.setTimeout(35000, (socket) => socket.destroy());
}
export function installShutdown(
  server,
  app,
  disconnect,
  { exit = (code) => process.exit(code), timeoutMs = 10000 } = {},
) {
  let draining = false;
  return function shutdown() {
    if (draining) return;
    draining = true;
    app.locals.draining = true;
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      exit(1);
    }, timeoutMs);
    deadline.unref();
    server.close(async () => {
      try {
        await disconnect();
        clearTimeout(deadline);
        exit(0);
      } catch {
        clearTimeout(deadline);
        exit(1);
      }
    });
    server.closeIdleConnections();
  };
}
