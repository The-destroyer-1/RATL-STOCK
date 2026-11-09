import "./globals.css";
import "./stock.css";

export const metadata = {
  title: "Ratl Stocks | Inventory Manager",
  description: "Track inventory, stock movements, and backups.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
