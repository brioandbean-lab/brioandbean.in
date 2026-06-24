const allowedOrigins = new Set([
  'https://brioandbean.in',
  'https://www.brioandbean.in',
  'https://brioandbean-in.vercel.app'
]);

function setCorsHeaders(req, res){
  const origin = req.headers.origin;
  if(allowedOrigins.has(origin)){
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
}

function clean(value){
  return String(value || '').trim();
}

function normalizeSupabaseUrl(value){
  return clean(value).replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

module.exports = async function handler(req, res){
  setCorsHeaders(req, res);

  if(req.method === 'OPTIONS'){
    return res.status(204).end();
  }

  if(req.method !== 'GET'){
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminKey = clean(process.env.ADMIN_ACCESS_KEY);
  const suppliedKey = clean(req.headers['x-admin-key']);
  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if(!adminKey || !supabaseUrl || !serviceRoleKey){
    return res.status(500).json({ error: 'Server is not configured' });
  }

  if(suppliedKey !== adminKey){
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const response = await fetch(
    supabaseUrl + '/rest/v1/preorders?select=id,created_at,name,phone,coffee,roast,pack_size,grind,source&order=created_at.desc&limit=100',
    {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: 'Bearer ' + serviceRoleKey,
        'Content-Type': 'application/json'
      }
    }
  );

  if(!response.ok){
    return res.status(502).json({ error: 'Could not load orders' });
  }

  const orders = await response.json();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ orders });
};
