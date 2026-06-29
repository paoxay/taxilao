"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Send, X } from "lucide-react";

type ChatMessage = {
  id: string;
  senderRole: string;
  senderName: string;
  text: string;
  createdAt?: string;
};

type ChatStatus = "idle" | "loading" | "sending" | "error";

type ChatCopy = {
  liveChat: string;
  noChatMessages: string;
  typeMessage: string;
};

const BUBBLE = 58;
const PANEL_W = 360;
const PANEL_H = 460;
const NAV_RESERVE = 96;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function FloatingChat({
  bookingId,
  messages,
  text,
  onTextChange,
  onSubmit,
  status,
  error,
  driverName,
  copy
}: {
  bookingId: string;
  messages: ChatMessage[];
  text: string;
  onTextChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  status: ChatStatus;
  error: string;
  driverName?: string;
  copy: ChatCopy;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ dx: number; dy: number; moved: boolean; pointerId: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const readKey = `taxilao_chat_read_${bookingId}`;
  const [lastRead, setLastRead] = useState(0);

  useEffect(() => {
    setMounted(true);
    setPos({
      x: window.innerWidth - BUBBLE - 18,
      y: window.innerHeight - BUBBLE - NAV_RESERVE
    });
    setLastRead(Number(localStorage.getItem(readKey) || 0));
  }, [readKey]);

  useEffect(() => {
    function onResize() {
      setPos((current) => ({
        x: clamp(current.x, 8, window.innerWidth - BUBBLE - 8),
        y: clamp(current.y, 8, window.innerHeight - BUBBLE - 8)
      }));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const unread = messages.filter(
    (message) => message.senderRole === "DRIVER" && new Date(message.createdAt || 0).getTime() > lastRead
  ).length;

  // Mark read whenever the panel is open (covers live incoming messages).
  useEffect(() => {
    if (!open) return;
    const latest = messages.reduce(
      (max, message) => Math.max(max, new Date(message.createdAt || 0).getTime()),
      0
    );
    const mark = Math.max(Date.now(), latest);
    localStorage.setItem(readKey, String(mark));
    setLastRead(mark);
  }, [open, messages, readKey]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  function startDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== undefined && event.button !== 0) return;
    drag.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y, moved: false, pointerId: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    const nextX = event.clientX - drag.current.dx;
    const nextY = event.clientY - drag.current.dy;
    if (Math.abs(nextX - pos.x) > 2 || Math.abs(nextY - pos.y) > 2) drag.current.moved = true;
    setPos({
      x: clamp(nextX, 8, window.innerWidth - BUBBLE - 8),
      y: clamp(nextY, 8, window.innerHeight - BUBBLE - 8)
    });
  }

  function endDrag() {
    const moved = drag.current?.moved;
    drag.current = null;
    if (!moved) setOpen((value) => !value);
  }

  if (!mounted) return null;

  const panelW = Math.min(PANEL_W, window.innerWidth - 24);
  const panelH = Math.min(PANEL_H, window.innerHeight - 160);
  const panelX = clamp(pos.x, 8, window.innerWidth - panelW - 8);
  const panelY = clamp(pos.y, 8, window.innerHeight - panelH - 8);

  return createPortal(
    <div className="float-chat" style={{ zIndex: 1000 }}>
      {open ? (
        <section
          className="float-chat-panel"
          style={{ left: panelX, top: panelY, width: panelW, height: panelH }}
          role="dialog"
          aria-label={copy.liveChat}
        >
          <header
            className="float-chat-head float-chat-handle"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className="float-chat-title">
              <MessageCircle size={17} />
              <strong>{copy.liveChat}</strong>
            </span>
            {driverName ? <small>{driverName}</small> : null}
            <button
              type="button"
              className="float-chat-close"
              aria-label="Close chat"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              <X size={16} />
            </button>
          </header>

          <div className="float-chat-messages" ref={scrollRef}>
            {messages.length ? (
              messages.map((message) => (
                <div className={`float-chat-bubble ${message.senderRole === "USER" ? "mine" : ""}`} key={message.id}>
                  <small>{message.senderName}</small>
                  <span>{message.text}</span>
                </div>
              ))
            ) : (
              <p className="float-chat-empty">{copy.noChatMessages}</p>
            )}
          </div>

          <form className="float-chat-form" onSubmit={onSubmit}>
            <input
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder={copy.typeMessage}
              onPointerDown={(event) => event.stopPropagation()}
            />
            <button type="submit" disabled={status === "sending" || !text.trim()} aria-label={copy.typeMessage}>
              <Send size={17} />
            </button>
          </form>
          {error ? <small className="float-chat-error">{error}</small> : null}
        </section>
      ) : (
        <button
          type="button"
          className="float-chat-bubble float-chat-handle"
          style={{ left: pos.x, top: pos.y, width: BUBBLE, height: BUBBLE }}
          aria-label={copy.liveChat}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <MessageCircle size={24} />
          {unread > 0 ? (
            <span className="float-chat-badge">{unread > 9 ? "9+" : unread}</span>
          ) : null}
        </button>
      )}
    </div>,
    document.body
  );
}
