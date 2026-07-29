import { NextResponse } from 'next/server';
import { getApiDocs, isSwaggerEnabled } from '@/lib/swagger';

export const GET = () => {
  if (!isSwaggerEnabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(getApiDocs());
};
