'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Home", href: "/" },
  { name: "Asset Library", href: "/library" },
  { name: "Log Center", href: "/logs" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              {/* Replace with your logo */}
              <span className="text-xl font-bold text-blue-700">AppLogo</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <OrganizationSwitcher 
            //   appearance={{
            //     elements: {
            //       rootBox: "flex justify-center",
            //       organizationSwitcherTrigger: "flex items-center gap-2 px-4 py-2 rounded-md bg-gray-50 hover:bg-gray-100",
            //     }
            //   }}
              afterSelectOrganizationUrl="/"
              afterCreateOrganizationUrl="/"
              afterLeaveOrganizationUrl="/"
            />
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8"
                }
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}