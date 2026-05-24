"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/app/_components/Button";

export function LogoutButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (pathname === "/login") {
    return null;
  }

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      className="w-full sm:w-auto"
      disabled={isSubmitting}
      onClick={handleLogout}
      type="button"
      variant="secondary"
    >
      {isSubmitting ? "Signing out..." : "Logout"}
    </Button>
  );
}
