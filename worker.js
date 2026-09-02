// hardywu.com front door: www.hardywu.com forwards to hardywu.com; everything
// else is served from the www/ folder (with its _redirects and 404 page).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.hardywu.com") {
      url.hostname = "hardywu.com";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
