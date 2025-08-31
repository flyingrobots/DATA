// Bridge file to import ES module oh-my-logo from CommonJS
module.exports = (async () => {
  const { render, renderFilled, PALETTES } = await import("oh-my-logo");
  return { render, renderFilled, PALETTES };
})();
