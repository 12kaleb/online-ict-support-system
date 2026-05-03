'use client';

import NextLink from 'next/link';
import { useParams as useNextParams, usePathname, useRouter } from 'next/navigation';

type LinkProps = Omit<React.ComponentProps<typeof NextLink>, 'href'> & {
  to: string;
};

export function Link({ to, ...props }: LinkProps) {
  return <NextLink href={to} {...props} />;
}

export function useNavigate() {
  const router = useRouter();

  return (to: string | number) => {
    if (typeof to === 'number') {
      if (to === -1) {
        router.back();
        return;
      }

      if (to === 1) {
        router.forward();
        return;
      }

      window.history.go(to);
      return;
    }

    router.push(to);
  };
}

export function useLocation() {
  const pathname = usePathname();

  return {
    pathname,
  };
}

export function useParams<T extends Record<string, string>>() {
  return useNextParams<T>() as T;
}
