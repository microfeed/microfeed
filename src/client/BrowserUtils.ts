/**
 * Put it in componentDidMount()
 */
export function preventCloseWhenChanged(hasChanged: any) {
  window.addEventListener('beforeunload', (e: any) => {
    if (hasChanged()) {
      e.preventDefault();
      e.returnValue = '';
      return;
    }

    delete e['returnValue'];
  });
}

export function readJsonScript<T = unknown>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`JSON data element #${id} was not found.`);
  }
  const content = element.textContent;
  if (!content) {
    throw new Error(`JSON data element #${id} was empty.`);
  }
  return JSON.parse(content) as T;
}
