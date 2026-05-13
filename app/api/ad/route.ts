import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const zoneId = searchParams.get('zoneId');
  
  if (!zoneId) {
    return NextResponse.json({ error: 'zoneId required' }, { status: 400 });
  }

  try {
    // Build the API payload like the ad-provider.js does
    const payload = {
      user: {
        ua: request.headers.get('user-agent') || 'Mozilla/5.0',
        language: 'en-NL',
        referer: request.headers.get('referer') || '',
        consumer: 'ad-provider',
        gdpr: { gdpr: 0 },
        screen_resolution: '1920x1080',
        window_orientation: 'landscape',
        cookies: [],
        scr_info: 'YXN5bmN8fDM%3D',
      },
      zones: [{
        custom_targeting: {},
        id: parseInt(zoneId),
        extra_params: { first_request: true, zone_type: 20 }
      }],
    };

    const response = await fetch('https://s.magsrv.com/v1/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch ad' }, { status: 502 });
    }

    const data = await response.json();
    
    // Extract first ad item from zones array
    const zone = data.zones?.find((z: any) => z.idzone === parseInt(zoneId));
    const adItem = zone?.data?.ad_items?.[0];
    
    if (!adItem) {
      return NextResponse.json({ error: 'No ad available' }, { status: 404 });
    }

    // Clean up brand (sometimes it's a URL)
    let brand = adItem.brand || 'ExoClick';
    if (brand.startsWith('http')) {
      brand = brand.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }

    return NextResponse.json({
      title: adItem.title || 'Ad',
      description: adItem.description || '',
      brand: brand,
      image: adItem.image || '',
      url: adItem.url || '#',
      optimum_image: adItem.optimum_image || adItem.image || '',
    });
  } catch (error) {
    console.error('Ad fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ad' }, { status: 500 });
  }
}
