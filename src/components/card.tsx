// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { CheckIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import cx from "classnames";
import { forwardRef } from "react";

import styles from "./card.module.css";

export const Stack = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Stack({ className, ...props }, ref) {
  return (
    <div className={cx(styles["stack"], className)} {...props} ref={ref} />
  );
});

interface RootProps extends React.HTMLAttributes<HTMLElement> {
  kind: "primary" | "secondary";
  narrow?: boolean;
}

export const Root = forwardRef<HTMLElement, RootProps>(function Root(
  { className, narrow, kind, ...props },
  ref,
) {
  return (
    <article
      className={cx(styles["root"], narrow && styles["narrow"], className)}
      data-kind={kind}
      {...props}
      ref={ref}
    />
  );
});

export const Header = forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(function Header({ className, ...props }, ref) {
  return (
    <header className={cx(styles["header"], className)} {...props} ref={ref} />
  );
});

export const Title = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function Title({ className, children, ...props }, ref) {
  return (
    <h2 className={cx(styles["title"], className)} {...props} ref={ref}>
      {children}
    </h2>
  );
});

interface IconProps extends React.HTMLAttributes<SVGElement> {
  icon: React.ComponentType<React.SVGAttributes<SVGElement>>;
}

export const Icon: React.FC<IconProps> = ({
  className,
  icon: IconComponent,
  ...props
}: IconProps) => (
  <IconComponent className={cx(styles["icon"], className)} {...props} />
);

export const Footer = forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(function Footer({ className, ...props }, ref) {
  return (
    <footer className={cx(styles["footer"], className)} {...props} ref={ref} />
  );
});

export const Body = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Body({ className, ...props }, ref) {
  return <div className={cx(styles["body"], className)} {...props} ref={ref} />;
});

export const Checklist = forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(function CheckList({ className, ...props }, ref) {
  return (
    <ul className={cx(styles["checklist"], className)} {...props} ref={ref} />
  );
});

export const ChecklistItem = forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(function CheckItem({ className, children, ...props }, ref) {
  return (
    <li
      className={cx(styles["checklist-item"], className)}
      {...props}
      ref={ref}
    >
      <CheckIcon className={styles["icon"]} />
      <div>{children}</div>
    </li>
  );
});
