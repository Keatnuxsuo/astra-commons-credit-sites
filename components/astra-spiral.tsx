import type { SVGProps } from 'react';

/** A gently asymmetric galaxy spiral, shared by the demo and credit reveal. */
export default function AstraSpiral({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    <path d="M20.2 4.2C16.5 2 11 2.7 7.4 5.8C3.2 9.4 2.6 15.1 5.8 18.6C9.1 22.2 15.3 21.2 18.3 17.4C21 14 20.1 9.5 16.7 8C13.1 6.4 8.8 8.6 8.2 12.1C7.7 15.2 10.5 17.1 13.1 16.1C15.5 15.2 16.1 12.4 14.2 11.3C12.7 10.5 11.1 11.7 11.6 13.1"/>
  </svg>;
}
