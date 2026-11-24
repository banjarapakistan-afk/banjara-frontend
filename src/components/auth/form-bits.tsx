"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, type KeyboardEvent } from "react";
import { ArrowRight, BadgeCheck, LoaderCircle, X, type LucideIcon } from "lucide-react";
import type { UploadFolder } from "@/services/customer/provider-application.service";
import { PhotoUpload } from "./photo-upload";
import styles from "./auth.module.css";
import v from "./vehicle.module.css";
import g from "./guide.module.css";

/* Small form pieces shared by the guide, tour operator and restaurant applications. */


export function Head({ n, id, title, sub }: { n: number; id: string; title: string; sub: string }) {
  return (
    <div className={v.sectionHead}>
      <span className={v.sectionNumber}>{n}</span>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

export function SaveButton({ busy, saving, uploading, onClick, label }: { busy: boolean; saving: boolean; uploading: boolean; onClick: () => void; label?: string }) {
  return (
    <>
      <p className={v.draftNote}>
        <BadgeCheck size={13} /> Each step is saved when you continue. You can come back and edit it any time.
      </p>
      <button type="button" className={styles.primary} disabled={busy} onClick={onClick}>
        {saving ? <LoaderCircle size={16} className="animate-spin" /> : null}
        {saving ? "Saving…" : uploading ? "Waiting for photos to upload…" : label ?? "Save and continue"}
        {busy ? null : <ArrowRight size={16} />}
      </button>
    </>
  );
}

export function TextArea({ label, value, onChange, max, min, placeholder }: { label: string; value: string; onChange: (value: string) => void; max: number; min?: number; placeholder?: string }) {
  const length = value.trim().length;
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <textarea className={g.textarea} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <span className={`${g.counter} ${min && length >= min ? g.counterOk : ""}`}>
        {min && length < min ? `${min - length} more characters` : `${length}/${max}`}
      </span>
    </label>
  );
}

export function TagInput({ label, icon: Icon, values, onChange, placeholder }: { label: string; icon: LucideIcon; values: string[]; onChange: (values: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) onChange([...values, ...parts.filter((p) => !values.some((x) => x.toLowerCase() === p.toLowerCase()))]);
    setText("");
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={g.tags}>
        <Icon size={15} color="#67788e" aria-hidden="true" />
        {values.map((value) => (
          <span key={value} className={g.tag}>
            {value}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((x) => x !== value))}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input className={g.tagInput} value={text} placeholder={values.length ? "" : placeholder} aria-label={label} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={add} />
      </div>
    </div>
  );
}

/** Photo grid with remove buttons and an "Add a photo" slot (uploads straight away). */
export function Gallery({
  label,
  images,
  onChange,
  trackUpload,
  folder,
  max = 8,
}: {
  label: string;
  images: string[];
  onChange: (images: string[]) => void;
  trackUpload: (on: boolean) => void;
  folder: UploadFolder;
  max?: number;
}) {
  const [slot, setSlot] = useState(0);
  return (
    <div className={styles.field}>
      <span className={v.choiceLabel}>{label}</span>
      <div className={g.gallery}>
        {images.map((url) => (
          <div key={url} className={g.tile}>
            <img src={url} alt="" />
            <button type="button" className={g.tileRemove} aria-label="Remove photo" onClick={() => onChange(images.filter((x) => x !== url))}>
              <X size={14} />
            </button>
          </div>
        ))}
        {images.length < max ? (
          <PhotoUpload
            key={slot}
            label={images.length ? "Add another" : "Add a photo"}
            folder={folder}
            onBusyChange={trackUpload}
            onChange={(url) => {
              if (!url) return;
              onChange([...images, url]);
              setSlot((n) => n + 1);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
