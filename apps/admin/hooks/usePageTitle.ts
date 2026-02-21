import { useEffect } from 'react';

const SUFFIX = 'Administration - Gikky.net';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} - ${SUFFIX}`;
    return () => {
      document.title = SUFFIX;
    };
  }, [title]);
}
