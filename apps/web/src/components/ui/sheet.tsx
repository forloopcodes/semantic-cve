"use client";

import * as React from "react";
import { Drawer as SheetPrimitive } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";

function SheetRoot({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root {...props} />;
}

function SheetTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return (
    <SheetPrimitive.Trigger
      data-slot="sheet-trigger"
      className={cn("inline-flex cursor-pointer", className)}
      {...props}
    />
  );
}

function SheetClose({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return (
    <SheetPrimitive.Close
      data-slot="sheet-close"
      className={cn("inline-flex cursor-pointer", className)}
      {...props}
    />
  );
}

function SheetPortal({
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return (
    <SheetPrimitive.Portal {...props}>
      <div className="fixed inset-0 z-50">{children}</div>
    </SheetPrimitive.Portal>
  );
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Backdrop>) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

interface SheetContentProps extends React.ComponentProps<typeof SheetPrimitive.Popup> {
  side?: "left" | "right" | "top" | "bottom";
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetContentProps) {
  const positionClasses = {
    top: "inset-x-0 top-0 border-b data-closed:slide-out-to-top data-open:slide-in-from-top",
    bottom:
      "inset-x-0 bottom-0 border-t data-closed:slide-out-to-bottom data-open:slide-in-from-bottom",
    left: "inset-y-0 left-0 h-full w-3/4 border-r data-closed:slide-out-to-left data-open:slide-in-from-left sm:max-w-sm",
    right:
      "inset-y-0 right-0 h-full w-3/4 border-l data-closed:slide-out-to-right data-open:slide-in-from-right sm:max-w-sm",
  };

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background p-6 shadow-lg transition-transform duration-200 data-closed:animate-out data-open:animate-in",
          positionClasses[side],
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in">
          <XIcon className="size-4" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

const Sheet = Object.assign(SheetRoot, {
  Root: SheetRoot,
  Trigger: SheetTrigger,
  Close: SheetClose,
  Content: SheetContent,
  Header: SheetHeader,
  Title: SheetTitle,
  Description: SheetDescription,
});

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
