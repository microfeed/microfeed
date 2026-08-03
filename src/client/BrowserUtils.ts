/**
 * Put it in componentDidMount()
 */
export function preventCloseWhenChanged(hasChanged: () => boolean): () => void {
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasChanged()) {
      e.preventDefault();
      Reflect.set(e, 'returnValue', '');
      return;
    }
  };
  const onBeforePreparation = (event: Event) => {
    if (hasChanged()) {
      event.preventDefault();
    }
  };

  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('astro:before-preparation', onBeforePreparation);

  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('astro:before-preparation', onBeforePreparation);
  };
}
