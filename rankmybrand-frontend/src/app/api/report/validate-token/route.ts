import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required', errorCode: 'TOKEN_INVALID' },
        { status: 400 }
      );
    }

    // Call backend API gateway to verify token
    const response = await fetch(`${API_GATEWAY}/api/admin/control/reports/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return NextResponse.json({
        valid: true,
        reportId: data.reportId,
        auditId: data.auditId,
        companyId: data.companyId,
      });
    } else {
      return NextResponse.json(
        {
          valid: false,
          error: data.error || 'Token validation failed',
          errorCode: data.error?.includes('expired') ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      {
        valid: false,
        error: 'Internal server error',
        errorCode: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
