'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AlertesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/appro'); }, [router]);
  return null;
}
