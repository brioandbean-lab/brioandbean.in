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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function clean(value){
  return String(value || '').trim();
}

function validatePreorder(order){
  const required = ['name', 'phone', 'coffee', 'pack_size', 'grind'];
  for(const field of required){
    if(!clean(order[field])){
      return field + ' is required';
    }
  }

  if(clean(order.phone).replace(/\D/g, '').length < 10){
    return 'phone is invalid';
  }

  return '';
}

module.exports = async function handler(req, res){
  setCorsHeaders(req, res);

  if(req.method === 'OPTIONS'){
    return res.status(204).end();
  }

  if(req.method !== 'POST'){
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = clean(process.env.SUPABASE_URL).replace(/\/$/, '');
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if(!supabaseUrl || !serviceRoleKey){
    return res.status(500).json({ error: 'Server is not configured' });
  }

  const order = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const validationError = validatePreorder(order);

  if(validationError){
    return res.status(400).json({ error: validationError });
  }

  const preorder = {
    name: clean(order.name),
    phone: clean(order.phone),
    coffee: clean(order.coffee),
    roast: clean(order.roast) || 'Medium Roast',
    pack_size: clean(order.pack_size),
    grind: clean(order.grind),
    source: clean(order.source) || 'website'
  };

  const response = await fetch(supabaseUrl + '/rest/v1/preorders', {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: 'Bearer ' + serviceRoleKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(preorder)
  });

  if(!response.ok){
    return res.status(502).json({ error: 'Could not save preorder' });
  }

  return res.status(200).json({ ok: true });
};
