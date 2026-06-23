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

  if(clean(order.phone).replace(/D/g, '').length < 10){
    return 'phone is invalid';
  }

  return '';
}

async function sendPreorderAlert(preorder){
  const resendApiKey = clean(process.env.RESEND_API_KEY);
  const alertEmail = clean(process.env.PREORDER_ALERT_EMAIL) || 'team.brioandbean@gmail.com';
  const fromEmail = clean(process.env.PREORDER_FROM_EMAIL);

  if(!resendApiKey || !fromEmail){
    return { skipped: true };
  }

  const subject = 'New Brio & Bean preorder from ' + preorder.name;
  const html = [
    '<h2>New preorder received</h2>',
    '<p><strong>Name:</strong> ' + preorder.name + '</p>',
    '<p><strong>Phone:</strong> ' + preorder.phone + '</p>',
    '<p><strong>Coffee:</strong> ' + preorder.coffee + '</p>',
    '<p><strong>Roast:</strong> ' + preorder.roast + '</p>',
    '<p><strong>Pack:</strong> ' + preorder.pack_size + '</p>',
    '<p><strong>Grind:</strong> ' + preorder.grind + '</p>',
    '<p><strong>Source:</strong> ' + preorder.source + '</p>'
  ].join('');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + resendApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [alertEmail],
      subject,
      html
    })
  });

  if(!response.ok){
    return { skipped: false, ok: false };
  }

  return { skipped: false, ok: true };
}

module.exports = async function handler(req, res){
  setCorsHeaders(req, res);

  if(req.method === 'OPTIONS'){
    return res.status(204).end();
  }

  if(req.method !== 'POST'){
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = clean(process.env.SUPABASE_URL).replace(//$/, '');
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

  const emailStatus = await sendPreorderAlert(preorder);
  return res.status(200).json({ ok: true, email: emailStatus });
};
