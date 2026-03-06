"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={variant === "destructive" ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {isLoading ? "En cours..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Hook for easier usage
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    variant?: "default" | "destructive"
    onConfirm: () => void | Promise<void>
    isLoading: boolean
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    isLoading: false,
  })

  const resolveRef = React.useRef<((value: boolean) => void) | null>(null)
  const versionRef = React.useRef(0)

  // Cleanup: resolve pending promise on unmount to prevent memory leak
  React.useEffect(() => {
    return () => {
      if (resolveRef.current) {
        resolveRef.current(false)
        resolveRef.current = null
      }
    }
  }, [])

  const confirm = React.useCallback(
    (options: {
      title: string
      description: string
      confirmLabel?: string
      variant?: "default" | "destructive"
    }): Promise<boolean> => {
      // Reject any previous pending dialog
      if (resolveRef.current) {
        resolveRef.current(false)
        resolveRef.current = null
      }

      const currentVersion = ++versionRef.current

      return new Promise((resolve) => {
        resolveRef.current = resolve
        setState({
          open: true,
          title: options.title,
          description: options.description,
          confirmLabel: options.confirmLabel,
          variant: options.variant,
          onConfirm: () => {
            if (versionRef.current !== currentVersion) return
            resolve(true)
            resolveRef.current = null
          },
          isLoading: false,
        })
      })
    },
    []
  )

  const close = React.useCallback(() => {
    // Resolve pending promise as false (cancel) to prevent memory leaks
    if (resolveRef.current) {
      resolveRef.current(false)
      resolveRef.current = null
    }
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  const Dialog = React.useCallback(
    () => (
      <ConfirmDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        variant={state.variant}
        onConfirm={state.onConfirm}
        isLoading={state.isLoading}
      />
    ),
    [state, close]
  )

  return { confirm, Dialog, close }
}
