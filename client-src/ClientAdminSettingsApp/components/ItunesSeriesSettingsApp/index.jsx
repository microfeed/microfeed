import React from 'react';
import AdminInput from "../../../components/AdminInput";
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";
import SettingsBase from "../SettingsBase";
import {showToast} from "../../../common/ToastUtils";

const SUBMIT_STATUS__START = 1;

export default class ItunesSeriesSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      submitStatus: null,
      items: [],
      newItem: {
        name: '',
        slug: '',
        description: '',
        image: '',
        sort_order: 0,
      },
    };
  }

  componentDidMount() {
    this.refresh();
  }

  refresh() {
    fetch('/admin/ajax/itunes-series').then((res) => res.json()).then((json) => {
      this.setState({items: json.items || []});
    });
  }

  updateItem(index, field, value) {
    this.setState((prev) => {
      const items = [...prev.items];
      items[index] = {...items[index], [field]: value};
      return {items};
    });
  }

  async saveItem(item) {
    this.setState({submitStatus: SUBMIT_STATUS__START});
    const res = await fetch('/admin/ajax/itunes-series', {
      method: 'PUT',
      headers: {'content-type': 'application/json;charset=UTF-8'},
      body: JSON.stringify(item),
    });
    this.setState({submitStatus: null});
    if (res.ok) {
      showToast('Updated!', 'success');
    } else {
      showToast('Failed. Please try again.', 'error');
    }
  }

  async deleteItem(item) {
    this.setState({submitStatus: SUBMIT_STATUS__START});
    const res = await fetch('/admin/ajax/itunes-series', {
      method: 'DELETE',
      headers: {'content-type': 'application/json;charset=UTF-8'},
      body: JSON.stringify({id: item.id}),
    });
    this.setState({submitStatus: null});
    if (res.ok) {
      showToast('Deleted!', 'success');
      this.refresh();
    } else {
      showToast('Failed. Please try again.', 'error');
    }
  }

  async createItem(e) {
    e.preventDefault();
    const {newItem} = this.state;
    if (!newItem.name) {
      showToast('Name is required.', 'error');
      return;
    }
    this.setState({submitStatus: SUBMIT_STATUS__START});
    const res = await fetch('/admin/ajax/itunes-series', {
      method: 'POST',
      headers: {'content-type': 'application/json;charset=UTF-8'},
      body: JSON.stringify(newItem),
    });
    this.setState({submitStatus: null});
    if (res.ok) {
      showToast('Created!', 'success');
      this.setState({newItem: {name: '', slug: '', description: '', image: '', sort_order: 0}});
      this.refresh();
    } else {
      showToast('Failed. Please try again.', 'error');
    }
  }

  render() {
    const {items, newItem, submitStatus} = this.state;
    const {feed} = this.props;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (
      <SettingsBase
        title="iTunes Series"
        currentType="itunes-series"
        submitting={submitting}
        submitForType={submitting ? "itunes-series" : null}
      >
        <div className="grid grid-cols-1 gap-4">
          {items.map((item, index) => (
            <div key={`itunes-series-${item.id}`} className="border rounded-sm p-3">
              <div className="grid grid-cols-2 gap-4">
                <AdminInput
                  label="Name"
                  value={item.name}
                  onChange={(e) => this.updateItem(index, 'name', e.target.value)}
                />
                <AdminInput
                  label="Slug"
                  value={item.slug}
                  onChange={(e) => this.updateItem(index, 'slug', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <AdminInput
                  label="Description"
                  value={item.description}
                  onChange={(e) => this.updateItem(index, 'description', e.target.value)}
                />
                <AdminInput
                  label="Sort order"
                  type="number"
                  value={item.sort_order}
                  onChange={(e) => this.updateItem(index, 'sort_order', parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div className="mt-4">
                <div className="lh-page-subtitle">Series image</div>
                <AdminImageUploaderApp
                  mediaType="itunes-series"
                  feed={feed}
                  currentImageUrl={item.image}
                  onImageUploaded={(cdnUrl) => this.updateItem(index, 'image', cdnUrl)}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  className="lh-btn lh-btn-brand-dark"
                  disabled={submitting}
                  onClick={(e) => {
                    e.preventDefault();
                    this.saveItem(item);
                  }}
                >
                  Save
                </button>
                <button
                  className="lh-btn lh-btn-outline"
                  disabled={submitting}
                  onClick={(e) => {
                    e.preventDefault();
                    const ok = confirm('Delete this series?');
                    if (ok) {
                      this.deleteItem(item);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t mt-4 pt-4">
          <div className="lh-page-subtitle mb-2">Add new series</div>
          <div className="grid grid-cols-2 gap-4">
            <AdminInput
              label="Name"
              value={newItem.name}
              onChange={(e) => this.setState({newItem: {...newItem, name: e.target.value}})}
            />
            <AdminInput
              label="Slug"
              value={newItem.slug}
              onChange={(e) => this.setState({newItem: {...newItem, slug: e.target.value}})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <AdminInput
              label="Description"
              value={newItem.description}
              onChange={(e) => this.setState({newItem: {...newItem, description: e.target.value}})}
            />
            <AdminInput
              label="Sort order"
              type="number"
              value={newItem.sort_order}
              onChange={(e) => this.setState({newItem: {...newItem, sort_order: parseInt(e.target.value || '0', 10)}})}
            />
          </div>
          <div className="mt-4">
            <div className="lh-page-subtitle">Series image</div>
            <AdminImageUploaderApp
              mediaType="itunes-series"
              feed={feed}
              currentImageUrl={newItem.image}
              onImageUploaded={(cdnUrl) => this.setState({newItem: {...newItem, image: cdnUrl}})}
            />
          </div>
          <div className="mt-2">
            <button
              className="lh-btn lh-btn-brand-dark"
              disabled={submitting}
              onClick={(e) => this.createItem(e)}
            >
              Add series
            </button>
          </div>
        </div>
      </SettingsBase>
    );
  }
}
