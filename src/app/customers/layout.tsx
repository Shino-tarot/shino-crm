import { AppHeader } from "@/components/layout/AppHeader";

export default function CustomersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
