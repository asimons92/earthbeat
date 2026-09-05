import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BLANK_PATCH_NAME } from '@/persist/patchFileActions';

type DiscardDialogProps = {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
};

export function DiscardChangesDialog({ open, onStay, onDiscard }: DiscardDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            Your Patch has edits that are not saved. Stay to keep editing, or Discard to lose those
            edits.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onStay}>
            Stay
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type NameDialogProps = {
  open: boolean;
  title: string;
  description: string;
  initialName: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

function PatchNameDialogFields({
  title,
  description,
  initialName,
  onCancel,
  onConfirm,
}: Omit<NameDialogProps, 'open'>) {
  const [name, setName] = useState(initialName.trim() ? initialName : BLANK_PATCH_NAME);

  return (
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="patch-name-input">Patch name</Label>
        <Input
          id="patch-name-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onConfirm(name.trim() || BLANK_PATCH_NAME);
            }
          }}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            onConfirm(name.trim() || BLANK_PATCH_NAME);
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function PatchNameDialog({
  open,
  title,
  description,
  initialName,
  onCancel,
  onConfirm,
}: NameDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {open ? (
        <PatchNameDialogFields
          key={`${title}:${initialName}`}
          title={title}
          description={description}
          initialName={initialName}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}

type DeleteDialogProps = {
  open: boolean;
  patchName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeletePatchDialog({ open, patchName, onCancel, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete this Patch?</DialogTitle>
          <DialogDescription>
            Delete removes {patchName} permanently. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
