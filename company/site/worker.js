// hardywu.com front door: plain http and www.hardywu.com both go to
// https://hardywu.com; everything else is served from the www/ folder
// (with its _redirects and 404 page).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== "https:" || url.hostname === "www.hardywu.com") {
      url.protocol = "https:";
      url.hostname = "hardywu.com";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
