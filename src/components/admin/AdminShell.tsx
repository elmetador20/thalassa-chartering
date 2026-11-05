'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styled from 'styled-components';
import { logoutAction } from '@/app/admin/actions/auth';
import { ROLE_LABELS, type AdminRole } from '@/lib/auth/permissions';

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  background: ${({ theme }) => theme.colors.navyDeep};
  color: #fff;
  border-bottom: 2px solid ${({ theme }) => theme.colors.orange};
`;

const BarInner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 clamp(16px, 3vw, 32px);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 24px;
  min-height: 64px;

  @media (max-width: 819px) {
    grid-template-columns: minmax(0, 1fr) auto;
    padding-top: 10px;
  }
`;

const Brand = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 12px;

  img {
    height: 22px;
    width: auto;
  }

  span {
    padding-left: 12px;
    border-left: 1px solid ${({ theme }) => theme.colors.lineOnDark};
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.78);
  }
`;

const Nav = styled.nav`
  min-width: 0;

  ul {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  @media (max-width: 819px) {
    grid-column: 1 / -1;
    grid-row: 2;
    margin: 0 -6px;
  }
`;

const NavLink = styled(Link)<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  font-size: 14.5px;
  white-space: nowrap;
  color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.74)')};
  box-shadow: ${({ $active, theme }) => ($active ? `inset 0 -2px 0 ${theme.colors.orange}` : 'none')};

  &:hover {
    color: #fff;
  }

  .short {
    display: none;
  }
  @media (max-width: 479px) {
    padding: 0 10px;
    .full {
      display: none;
    }
    .short {
      display: inline;
    }
  }
`;

const Account = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  justify-self: end;

  .who {
    text-align: right;
    line-height: 1.25;
  }
  .name {
    font-size: 14px;
    font-weight: 500;
  }
  .role {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  @media (max-width: 479px) {
    .who {
      display: none;
    }
  }
`;

const SignOut = styled.button`
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: ${({ theme }) => theme.layout.radius};
  font-size: 13.5px;
  font-weight: 500;
  color: #fff;

  &:hover {
    border-color: #fff;
  }
`;

const Main = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 44px) clamp(16px, 3vw, 32px) 64px;
`;

interface ShellProps {
  admin: { name: string; role: AdminRole };
  /** From the server's permission table; hides links the role cannot use.
   *  Hiding is cosmetic — the pages themselves refuse unauthorised roles. */
  canManageAdmins: boolean;
  children: React.ReactNode;
}

export default function AdminShell({ admin, canManageAdmins, children }: ShellProps) {
  const pathname = usePathname();
  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/reports', label: 'Reports' },
    // On phones "Admins" keeps all four tabs on screen from 360px up.
    ...(canManageAdmins ? [{ href: '/admin/users', label: 'Administrators', short: 'Admins' }] : []),
    { href: '/admin/account', label: 'Account' },
  ] as { href: string; label: string; short?: string }[];
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  return (
    <>
      <Bar>
        <BarInner>
          <Brand href="/admin" aria-label="INCWORX admin dashboard">
            <Image src="/images/incworx-logo-reversed.png" alt="INCWORX" width={1396} height={195} sizes="160px" priority />
            <span>Admin</span>
          </Brand>

          <Nav aria-label="Admin">
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <NavLink
                    href={link.href}
                    $active={isActive(link.href)}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    aria-label={link.short ? link.label : undefined}
                  >
                    {link.short ? (
                      <>
                        <span className="full">{link.label}</span>
                        <span className="short" aria-hidden="true">
                          {link.short}
                        </span>
                      </>
                    ) : (
                      link.label
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </Nav>

          <Account>
            <div className="who">
              <div className="name">{admin.name}</div>
              <div className="role">{ROLE_LABELS[admin.role]}</div>
            </div>
            <form action={logoutAction}>
              <SignOut type="submit">Sign out</SignOut>
            </form>
          </Account>
        </BarInner>
      </Bar>
      <Main id="main">{children}</Main>
    </>
  );
}
