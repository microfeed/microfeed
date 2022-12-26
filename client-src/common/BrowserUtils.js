/**
 * Put it in componentDidMount()
 */
export function preventCloseWhenChanged(hasChanged) {
  window.addEventListener('beforeunload', (e) => {
    if (hasChanged()) {
      e.preventDefault();
      e.returnValue = '';
      return;
    }

    delete e['returnValue'];
  });
}
