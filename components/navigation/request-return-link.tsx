"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import {
  buildRequestHref,
  scrollStorageKey,
} from "@/lib/navigation/return-to";

type RequestReturnLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  requestId: string;
  basePath?: "/requests" | "/work/requests";
  children: ReactNode;
  /** When set, skips reading the current URL via useSearchParams. */
  returnPath?: string;
};

function rememberScroll(returnPath: string) {
  try {
    sessionStorage.setItem(
      scrollStorageKey(returnPath),
      String(window.scrollY),
    );
  } catch {
    // sessionStorage may be unavailable
  }
}

export function RequestReturnLink({
  basePath = "/requests",
  children,
  className,
  onClick,
  requestId,
  returnPath,
  ...rest
}: RequestReturnLinkProps) {
  if (returnPath) {
    return (
      <StaticRequestReturnLink
        {...rest}
        basePath={basePath}
        className={className}
        onClick={onClick}
        requestId={requestId}
        returnPath={returnPath}
      >
        {children}
      </StaticRequestReturnLink>
    );
  }

  return (
    <AutoRequestReturnLink
      {...rest}
      basePath={basePath}
      className={className}
      onClick={onClick}
      requestId={requestId}
    >
      {children}
    </AutoRequestReturnLink>
  );
}

function StaticRequestReturnLink({
  basePath = "/requests",
  children,
  className,
  onClick,
  requestId,
  returnPath,
  ...rest
}: RequestReturnLinkProps & { returnPath: string }) {
  const href = buildRequestHref(requestId, returnPath, basePath);

  return (
    <Link
      {...rest}
      className={className}
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        rememberScroll(returnPath);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}

function AutoRequestReturnLink({
  basePath = "/requests",
  children,
  className,
  onClick,
  requestId,
  ...rest
}: Omit<RequestReturnLinkProps, "returnPath">) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnPath = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  return (
    <StaticRequestReturnLink
      {...rest}
      basePath={basePath}
      className={className}
      onClick={onClick}
      requestId={requestId}
      returnPath={returnPath}
    >
      {children}
    </StaticRequestReturnLink>
  );
}
