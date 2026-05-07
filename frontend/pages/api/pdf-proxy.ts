import type { NextApiRequest, NextApiResponse } from 'next';

const isAllowedHost = (hostname: string): boolean =>
  hostname === 'storage.googleapis.com' ||
  hostname === 'storage.cloud.google.com' ||
  hostname.endsWith('.storage.googleapis.com');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ detail: 'Method not allowed.' });
    return;
  }

  const urlParam = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!urlParam) {
    res.status(400).json({ detail: 'Missing url query parameter.' });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlParam);
  } catch {
    res.status(400).json({ detail: 'Invalid url query parameter.' });
    return;
  }

  if (parsedUrl.protocol !== 'https:' || !isAllowedHost(parsedUrl.hostname)) {
    res.status(400).json({ detail: 'URL is not allowed.' });
    return;
  }

  try {
    const upstream = await fetch(parsedUrl.toString());
    if (!upstream.ok) {
      res.status(upstream.status).json({ detail: 'Failed to fetch PDF.' });
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline; filename="assignment.pdf"');

    const arrayBuffer = await upstream.arrayBuffer();
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch {
    res.status(500).json({ detail: 'Failed to proxy PDF.' });
  }
}
