import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function placeMenu(anchor, menu, { placement, align }) {
  const rect = anchor.getBoundingClientRect();
  const width = menu.offsetWidth || 240;
  const height = menu.offsetHeight || 160;
  const gap = 8;
  const below = rect.bottom + gap;
  const above = rect.top - height - gap;
  let top = placement === "above" ? above : below;
  if (placement === "above" && top < 8) top = below;
  if (placement !== "above" && top + height > window.innerHeight - 8) top = Math.max(8, above);
  if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
  let left = align === "end" ? rect.right - width : rect.left;
  left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
  return { top, left, width };
}

function AnchoredMenu({ open, anchorRef, onClose, placement = "below", align = "start", label, children }) {
  const menuRef = useRef(null);
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !menuRef.current) return undefined;
    const update = () => setStyle(placeMenu(anchorRef.current, menuRef.current, { placement, align }));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, placement, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      const items = [...(menuRef.current?.querySelectorAll("[role='menuitem']") || [])];
      const index = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      }
    };
    const onPointer = (event) => {
      if (menuRef.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div ref={menuRef} className="anchored-menu" style={style ? { top: style.top, left: style.left, minWidth: Math.max(style.width, 220) } : { visibility: "hidden" }} role="menu" aria-label={label}>
      {children}
    </div>,
    document.body,
  );
}

export default AnchoredMenu;
