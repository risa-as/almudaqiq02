import { NextRequest, NextResponse } from 'next/server';
import { getMachineId } from '@/lib/machineId';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const machineId = getMachineId();
        return NextResponse.json({ machineId });
    } catch (error) {
        console.error('Machine ID Error:', error);
        return NextResponse.json({ machineId: 'unknown', error: 'فشل قراءة بصمة الجهاز' }, { status: 500 });
    }
}
