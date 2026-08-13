import React from 'react';
import clsx from "clsx";
import SettingsBase from "../SettingsBase";
import {PUBLIC_URLS, randomShortUUID} from "@/shared/StringUtils";
import {
  CirclePlusIcon,
  GripVerticalIcon,
  Trash2Icon,
} from "lucide-react";
import AdminInput from "@/components/admin/shared/AdminInput";
import AdminSwitch from "@/components/admin/shared/AdminSwitch";
import ExternalLink from "@/components/admin/shared/ExternalLink";
import {PREDEFINED_SUBSCRIBE_METHODS, SETTINGS_CATEGORIES} from '@/shared/Constants';
import NewSubscribeDialog from "./components/NewSubscribeDialog";
import AdminHelpLabel from "@/components/admin/shared/AdminHelpLabel";
import {
  SETTINGS_CONTROLS,
  CONTROLS_TEXTS_DICT
} from "../AdminHelpContent";
import {Button} from "@/components/ui/button";

function initMethodsDict() {
  return {
    methods: [
      {...PREDEFINED_SUBSCRIBE_METHODS.rss, id: randomShortUUID(), editable: false, enabled: true},
      {...PREDEFINED_SUBSCRIBE_METHODS.json, id: randomShortUUID(), editable: false, enabled: true},
    ],
  };
}

export function subscribeMethodsBundle(methodsDict: any) {
  return {
    ...methodsDict,
    methods: (methodsDict.methods || [])
      .filter((method: any) => !method.deleted)
      .map((method: any) => {
        const savedMethod = {...method};
        delete savedMethod.deleted;
        return savedMethod;
      }),
  };
}

export function reorderSubscribeMethods(
  methods: any[],
  draggedMethodId: string,
  targetMethodId: string,
  position: "before" | "after",
) {
  if (draggedMethodId === targetMethodId) {
    return methods;
  }
  const draggedIndex = methods.findIndex(({id}) => id === draggedMethodId);
  const targetIndex = methods.findIndex(({id}) => id === targetMethodId);
  if (draggedIndex < 0 || targetIndex < 0) {
    return methods;
  }

  const reordered = [...methods];
  const [draggedMethod] = reordered.splice(draggedIndex, 1);
  const adjustedTargetIndex = reordered.findIndex(({id}) => id === targetMethodId);
  reordered.splice(
    position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex,
    0,
    draggedMethod,
  );
  return reordered.every(({id}, index) => id === methods[index]?.id)
    ? methods
    : reordered;
}

function MethodRow({
  beginDragging,
  dragging,
  dropPosition,
  firstIndex,
  index,
  lastIndex,
  method,
  moveCard,
  updateMethodByAttr,
}: any) {
  const { id, name, type, editable, enabled, image, deleted } = method;
  let { url } = method;
  if (!url && !editable) {
    switch (type) {
      case 'rss':
        url = PUBLIC_URLS.rssFeed();
        break;
      case 'json':
        url = PUBLIC_URLS.jsonFeed();
        break;
      default:
        break;
    }
  }

  return (<div
    className={clsx(
      'relative flex flex-wrap items-start gap-y-3 border-b py-4 transition sm:flex-nowrap',
      dragging && 'bg-muted/40 opacity-60',
      dropPosition && 'z-10 bg-brand-light/8 ring-1 ring-inset ring-brand-light/40',
      dropPosition === 'before' &&
        'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:rounded-full before:bg-brand-light',
      dropPosition === 'after' &&
        'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-light',
    )}
    data-subscribe-method-id={id}
  >
    <div className="mr-3 flex flex-none items-center justify-start">
      <Button
        aria-label={`Drag to change the order of ${name}`}
        aria-roledescription="sortable item"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        size="icon-sm"
        title="Drag to change the order. Use Arrow Up or Arrow Down with the keyboard."
        type="button"
        variant="ghost"
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === "ArrowUp" && !firstIndex) {
            moveCard(event, index, index - 1);
          } else if (event.key === "ArrowDown" && !lastIndex) {
            moveCard(event, index, index + 1);
          }
        }}
        onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          beginDragging(id, event);
        }}
      >
        <GripVerticalIcon className="size-4" />
      </Button>
    </div>
    <div className="mr-4 flex flex-none items-center justify-end">
      <img
        src={image}
        className={clsx('size-11 object-contain', enabled ? '' : 'opacity-50')}
        alt={name}
      />
    </div>
    <div className="min-w-0 flex-[1_1_18rem]">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
        <div className="md:col-span-4">
          <AdminInput
            value={name}
            disabled={!editable || !enabled}
            onChange={(e: any) => updateMethodByAttr(id, 'name', e.target.value, false)}
            customClass="text-xs p-1"
          />
        </div>
        <div className="md:col-span-8">
          <div className="flex-1 flex items-center">
            <AdminInput
              value={url}
              disabled={!editable || !enabled}
              onChange={(e: any) => updateMethodByAttr(id, 'url', e.target.value, false)}
              customClass="text-xs p-1"
            />
            <div className="flex-none ml-1">
              <ExternalLink url={url} text="" linkClass="text-xs"/>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center">
        <div className="">
          <AdminSwitch
            label="Visible"
            labelClassName={clsx('text-xs', enabled ? 'text-foreground' : 'text-muted-foreground')}
            checked={enabled}
            onCheckedChange={(checked) => updateMethodByAttr(id, 'enabled', checked)}
          />
        </div>
        <div className="ml-4">
          {editable && <div>
            {!deleted ? <div><Button
              type="button"
              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              variant="ghost"
              onClick={() => {
                updateMethodByAttr(id, 'deleted', true);
              }}>
              <Trash2Icon className="w-4"/>
              Delete
            </Button></div> : <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Deleted.</span>
              <Button
                className="h-auto px-0 text-xs text-brand-light"
                size="xs"
                type="button"
                variant="link"
                onClick={() => updateMethodByAttr(id, 'deleted', false)}
              >
                Undo
              </Button>
            </div>}
          </div>}
        </div>
      </div>
    </div>
  </div>);
}

function FloatingMethodPreview({method, position}: any) {
  const {enabled, image, name, type, url} = method;
  const displayUrl = url || (type === "rss"
    ? PUBLIC_URLS.rssFeed()
    : type === "json"
      ? PUBLIC_URLS.jsonFeed()
      : "");
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[100] flex min-h-20 items-center gap-3 rounded-xl border border-brand-light/60 bg-card/95 px-4 py-3 shadow-2xl ring-2 ring-brand-light/20 backdrop-blur-sm"
      style={{
        left: position.left,
        maxWidth: "calc(100vw - 1rem)",
        top: position.top,
        transform: "rotate(0.35deg) scale(1.01)",
        width: position.width,
      }}
    >
      <GripVerticalIcon className="size-4 shrink-0 text-brand-light" />
      <img
        alt=""
        className={clsx("size-11 shrink-0 object-contain", !enabled && "opacity-50")}
        src={image}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-card-foreground">
          {name}
        </span>
        {displayUrl && (
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {displayUrl}
          </span>
        )}
      </span>
    </div>
  );
}

function AddNewMethod({isOpenNewMethod, setIsOpenNewMethod, addNewMethod}: any) {
  return (<div>
    <div className="flex justify-center">
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setIsOpenNewMethod(true);
        }}
      >
        <CirclePlusIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>Add new subscribe method</span>
      </Button>
    </div>
    <div className="mt-1 text-xs text-muted-color text-center">e.g., Apple Podcasts, Spotify, Listen Notes...</div>
    <NewSubscribeDialog
      isOpen={isOpenNewMethod}
      setIsOpen={setIsOpenNewMethod}
      addNewMethod={addNewMethod}
    />
  </div>);
}

export default class SubscribeSettingsApp extends React.Component<any, any> {
  private activeDragPointerId: number | null = null;
  private dragOrderChanged = false;
  private saveQueue: Promise<void> = Promise.resolve();
  private textSaveTimer?: ReturnType<typeof setTimeout>;

  constructor(props: any) {
    super(props);
    this.updateMethodByAttr = this.updateMethodByAttr.bind(this);
    this.addNewMethod = this.addNewMethod.bind(this);
    this.beginDragging = this.beginDragging.bind(this);
    this.dragMethod = this.dragMethod.bind(this);
    this.endDragging = this.endDragging.bind(this);
    this.handleDragPointerEnd = this.handleDragPointerEnd.bind(this);
    this.handleDragPointerMove = this.handleDragPointerMove.bind(this);
    this.handleDragWindowBlur = this.handleDragWindowBlur.bind(this);
    this.moveCard = this.moveCard.bind(this);
    this.persistMethods = this.persistMethods.bind(this);

    const currentType = SETTINGS_CATEGORIES.SUBSCRIBE_METHODS;
    const {settings} = props.feed;
    let methodsDict;
    if (settings && settings[currentType]) {
      methodsDict = settings[currentType];
    } else {
      methodsDict = initMethodsDict();
    }
    this.state = {
      currentType,
      dragOverMethodId: null,
      dragOverPosition: null,
      dragPreview: null,
      draggedMethodId: null,
      methodsDict,
      isOpenNewMethod: false,
    };
  }

  componentWillUnmount() {
    this.removeDragListeners();
    if (this.textSaveTimer !== undefined) {
      clearTimeout(this.textSaveTimer);
    }
  }

  persistMethods(methodsDict: any) {
    const bundle = subscribeMethodsBundle(methodsDict);
    const {currentType} = this.state;
    this.saveQueue = this.saveQueue
      .then(async () => {
        await this.props.onSubmit(
          {preventDefault() {}},
          currentType,
          bundle,
        );
      })
      .catch(() => undefined);
  }

  updateMethods(
    transform: (methods: any[]) => any[],
    persistImmediately = true,
  ) {
    this.setState((prevState: any) => {
      const methods = transform(prevState.methodsDict.methods || []);
      return {
        methodsDict: {
          ...prevState.methodsDict,
          methods,
        },
      };
    }, () => {
      this.props.setChanged();
      if (persistImmediately) {
        if (this.textSaveTimer !== undefined) {
          clearTimeout(this.textSaveTimer);
          this.textSaveTimer = undefined;
        }
        this.persistMethods(this.state.methodsDict);
        return;
      }
      if (this.textSaveTimer !== undefined) {
        clearTimeout(this.textSaveTimer);
      }
      this.textSaveTimer = setTimeout(() => {
        this.textSaveTimer = undefined;
        this.persistMethods(this.state.methodsDict);
      }, 600);
    });
  }

  updateMethodByAttr(
    methodId: any,
    attrName: any,
    attrValue: any,
    persistImmediately = true,
  ) {
    this.updateMethods(
      (methods) => methods.map((method: any) => method.id === methodId
        ? {...method, [attrName]: attrValue}
        : method),
      persistImmediately,
    );
  }

  addNewMethod(newMethod: any) {
    this.updateMethods((methods) => [...methods, newMethod]);
  }

  beginDragging(
    methodId: string,
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    this.removeDragListeners();
    this.activeDragPointerId = event.pointerId;
    window.addEventListener("blur", this.handleDragWindowBlur);
    window.addEventListener("pointercancel", this.handleDragPointerEnd);
    window.addEventListener("pointermove", this.handleDragPointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", this.handleDragPointerEnd);
    this.dragOrderChanged = false;
    const row = event.currentTarget.closest<HTMLElement>(
      "[data-subscribe-method-id]",
    );
    const bounds = row?.getBoundingClientRect();
    this.setState({
      dragOverMethodId: null,
      dragOverPosition: null,
      dragPreview: bounds
        ? {
            left: bounds.left,
            offsetX: event.clientX - bounds.left,
            offsetY: event.clientY - bounds.top,
            top: bounds.top,
            width: bounds.width,
          }
        : null,
      draggedMethodId: methodId,
    });
  }

  handleDragPointerMove(event: PointerEvent) {
    if (
      event.pointerId !== this.activeDragPointerId ||
      !this.state.draggedMethodId
    ) {
      return;
    }
    event.preventDefault();
    this.dragMethod(event, this.state.draggedMethodId);
  }

  handleDragPointerEnd(event: PointerEvent) {
    if (event.pointerId !== this.activeDragPointerId) return;
    this.endDragging();
  }

  handleDragWindowBlur() {
    this.endDragging();
  }

  removeDragListeners() {
    if (typeof window === "undefined") return;
    window.removeEventListener("blur", this.handleDragWindowBlur);
    window.removeEventListener("pointercancel", this.handleDragPointerEnd);
    window.removeEventListener("pointermove", this.handleDragPointerMove);
    window.removeEventListener("pointerup", this.handleDragPointerEnd);
  }

  dragMethod(
    event: Pick<PointerEvent, "clientX" | "clientY">,
    draggedMethodId: string,
  ) {
    this.setState((prevState: any) => prevState.dragPreview
      ? {
          dragPreview: {
            ...prevState.dragPreview,
            left: event.clientX - prevState.dragPreview.offsetX,
            top: event.clientY - prevState.dragPreview.offsetY,
          },
        }
      : null);
    const targetRow = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-subscribe-method-id]");
    const targetMethodId = targetRow?.dataset.subscribeMethodId;
    if (!targetRow || !targetMethodId || targetMethodId === draggedMethodId) {
      this.setState({dragOverMethodId: null, dragOverPosition: null});
      return;
    }
    const targetBounds = targetRow.getBoundingClientRect();
    const position = event.clientY < targetBounds.top + targetBounds.height / 2
      ? "before"
      : "after";
    this.setState((prevState: any) => {
      const currentMethods = prevState.methodsDict.methods || [];
      const methods = reorderSubscribeMethods(
        currentMethods,
        draggedMethodId,
        targetMethodId,
        position,
      );
      if (methods === currentMethods) {
        return prevState.dragOverMethodId === targetMethodId &&
            prevState.dragOverPosition === position
          ? null
          : {
              dragOverMethodId: targetMethodId,
              dragOverPosition: position,
            };
      }
      this.dragOrderChanged = true;
      return {
        dragOverMethodId: targetMethodId,
        dragOverPosition: position,
        methodsDict: {
          ...prevState.methodsDict,
          methods,
        },
      };
    });
  }

  endDragging() {
    this.removeDragListeners();
    this.activeDragPointerId = null;
    const orderChanged = this.dragOrderChanged;
    this.dragOrderChanged = false;
    this.setState({
      dragOverMethodId: null,
      dragOverPosition: null,
      dragPreview: null,
      draggedMethodId: null,
    }, () => {
      if (!orderChanged) return;
      this.props.setChanged();
      if (this.textSaveTimer !== undefined) {
        clearTimeout(this.textSaveTimer);
        this.textSaveTimer = undefined;
      }
      this.persistMethods(this.state.methodsDict);
    });
  }

  moveCard(e: any, oldIndex: any, newIndex: any) {
    e.preventDefault();
    this.updateMethods((methods) => {
      const reordered = [...methods];
      const element = reordered.splice(oldIndex, 1)[0];
      reordered.splice(newIndex, 0, element);
      return reordered;
    });
  }

  render() {
    const {
      currentType,
      dragOverMethodId,
      dragOverPosition,
      dragPreview,
      draggedMethodId,
      methodsDict,
      isOpenNewMethod,
    } = this.state;
    const methods = methodsDict.methods || [];
    const draggedMethod = draggedMethodId
      ? methods.find(({id}: any) => id === draggedMethodId)
      : null;
    return (<SettingsBase
      titleComponent={<AdminHelpLabel help={CONTROLS_TEXTS_DICT[SETTINGS_CONTROLS.SUBSCRIBE_METHODS]}/>}
      currentType={currentType}
    >
      <div className="mb-4">
        {methods.map((method: any, i: any) => <MethodRow
          beginDragging={this.beginDragging}
          dragging={draggedMethodId === method.id}
          dropPosition={dragOverMethodId === method.id ? dragOverPosition : null}
          method={method}
          key={`${method.id}-row`}
          updateMethodByAttr={this.updateMethodByAttr}
          index={i}
          firstIndex={i === 0}
          lastIndex={i === methods.length - 1}
          moveCard={this.moveCard}
        />)}
      </div>
      <AddNewMethod
        isOpenNewMethod={isOpenNewMethod}
        setIsOpenNewMethod={(isOpen: any) => this.setState({isOpenNewMethod: isOpen})}
        addNewMethod={this.addNewMethod}
      />
      {dragPreview && draggedMethod && (
        <FloatingMethodPreview method={draggedMethod} position={dragPreview} />
      )}
    </SettingsBase>);
  }
}
