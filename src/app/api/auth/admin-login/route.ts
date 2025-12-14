import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse, AuthTokenPayload } from '@/types';

// In production, store these in a database
const ADMIN_USERS = [
  {
    id: 'admin_1',
    email: 'admin@minimusiker.com',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    role: 'admin' as const,
  },
];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find admin user
    const adminUser = ADMIN_USERS.find((user) => user.email === email);

    if (!adminUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create JWT token
    const tokenPayload: Omit<AuthTokenPayload, 'exp' | 'iat'> = {
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
      expiresIn: '8h',
    });

    // Create response with cookie
    const response = NextResponse.json<ApiResponse>({
      success: true,
      data: {
        token,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
        },
      },
    });

    // Set HTTP-only cookie
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during admin login:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Logout endpoint
  const response = NextResponse.json<ApiResponse>({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.delete('admin_token');

  return response;
}