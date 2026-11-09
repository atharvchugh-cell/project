import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { BASE_URL, DEFAULT_IMAGE, NOT_FOUND_HEAD, PUBLIC_ROBOTS, breadcrumbJsonLd, resolveHead } from "./routes";

/**
 * The only owner of title / description / canonical / robots / og:* / twitter:*
 * for every route. Pages may add page-specific JSON-LD but never these tags.
 * Dynamic private routes (/c/:code, /r/:id) keep their own titles; this
 * component still forces noindex for them.
 */
export function RouteHead() {
  const { pathname } = useLocation();
  const head = resolveHead(pathname);

  if (head.kind === "dynamic-noindex") {
    return <Helmet><meta name="robots" content="noindex,follow" /></Helmet>;
  }

  if (head.kind === "public") {
    const r = head.route;
    const url = `${BASE_URL}${r.path}`;
    const image = r.image ?? DEFAULT_IMAGE;
    return (
      <Helmet>
        <title>{r.title}</title>
        <meta name="description" content={r.description} />
        <meta name="robots" content={PUBLIC_ROBOTS} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content={r.ogType} />
        <meta property="og:title" content={r.title} />
        <meta property="og:description" content={r.description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={image} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={r.title} />
        <meta name="twitter:description" content={r.description} />
        <meta name="twitter:image" content={image} />
        {r.breadcrumb && <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd(r.breadcrumb))}</script>}
      </Helmet>
    );
  }

  const { title, description } = head.kind === "noindex" ? head : NOT_FOUND_HEAD;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex,follow" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {head.kind === "noindex" && <meta property="og:url" content={`${BASE_URL}${head.path}`} />}
      <meta property="og:image" content={DEFAULT_IMAGE} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={DEFAULT_IMAGE} />
    </Helmet>
  );
}
