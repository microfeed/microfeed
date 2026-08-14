import {useState} from "react";
import {PencilIcon, PlusIcon, Trash2Icon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import {showToast} from "@/client/ToastUtils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {
  categorySlugFromName,
  type CategoryRecord,
} from "@/shared/Categories";

interface Props {
  categories: CategoryRecord[];
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & {error?: string};
  if (!response.ok) {
    throw new Error(body.error ?? "The request failed.");
  }
  return body;
}

interface CategoryFormState {
  name: string;
  slug: string;
}

function emptyForm(): CategoryFormState {
  return {name: "", slug: ""};
}

export default function CategoriesApp({categories: initialCategories}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm());

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (category: CategoryRecord) => {
    setEditing(category);
    setForm({name: category.name, slug: category.slug});
    setDialogOpen(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast("A category name is required.", "error");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name,
        ...(form.slug.trim() ? {slug: form.slug.trim()} : {}),
      };
      if (editing) {
        const updated = await responseJson<CategoryRecord>(await fetch(
          ADMIN_URLS.ajaxCategory(editing.id),
          {
            body: JSON.stringify(body),
            headers: {"Content-Type": "application/json"},
            method: "PUT",
          },
        ));
        setCategories((current) => current.map((category) =>
          category.id === updated.id ? updated : category
        ));
        showToast("Category updated.", "success");
      } else {
        const created = await responseJson<CategoryRecord>(await fetch(
          ADMIN_URLS.ajaxCategories(),
          {
            body: JSON.stringify(body),
            headers: {"Content-Type": "application/json"},
            method: "POST",
          },
        ));
        setCategories((current) => [...current, created]);
        showToast("Category created.", "success");
      }
      setDialogOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: CategoryRecord) => {
    if (!window.confirm(
      `Delete the category \`${category.name}\`? Items keep their content but ` +
        "lose this category.",
    )) {
      return;
    }
    setBusy(true);
    try {
      await responseJson(await fetch(
        ADMIN_URLS.ajaxCategory(category.id),
        {method: "DELETE"},
      ));
      setCategories((current) => current.filter((entry) =>
        entry.id !== category.id
      ));
      showToast("Category deleted.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Categories organize your posts. Each post can carry up to two
          categories.
        </p>
        <Button disabled={busy} onClick={openCreate} type="button">
          <PlusIcon aria-hidden="true" /> Add Category
        </Button>
      </div>
      <div className="grid gap-3">
        {categories.length === 0 ? (
          <p className="rounded-[14px] border bg-card p-5 text-sm text-muted-foreground shadow-xs">
            No categories yet. Add your first category to start organizing
            posts.
          </p>
        ) : categories.map((category) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-card p-4 text-card-foreground shadow-xs"
            key={category.id}
          >
            <div>
              <h2 className="font-semibold">{category.name}</h2>
              <p className="text-xs text-muted-foreground">/{category.slug}</p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() => openEdit(category)}
                size="sm"
                type="button"
                variant="outline"
              >
                <PencilIcon aria-hidden="true" /> Rename
              </Button>
              <Button
                disabled={busy}
                onClick={() => void remove(category)}
                size="sm"
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon aria-hidden="true" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      <AdminDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={editing ? "Rename category" : "Add category"}
      >
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              autoFocus
              id="category-name"
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({
                  ...current,
                  name,
                  ...(editing || current.slug ? {} : {
                    slug: categorySlugFromName(name),
                  }),
                }));
              }}
              placeholder="e.g. Essays"
              value={form.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              onChange={(event) => setForm((current) => ({
                ...current,
                slug: event.target.value,
              }))}
              placeholder="essays"
              value={form.slug}
            />
            <p className="text-xs text-muted-foreground">
              Used in public URLs. Leave blank to derive it from the name.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              disabled={busy}
              onClick={() => setDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()} type="button">
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </AdminDialog>
    </div>
  );
}
