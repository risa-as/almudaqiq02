import { NextResponse } from 'next/server';

export async function GET() {
    // This is a dummy endpoint to prevent old NextAuth browser tabs 
    // from spamming the Next.js dev server with 404 errors.
    return NextResponse.json({});
}
