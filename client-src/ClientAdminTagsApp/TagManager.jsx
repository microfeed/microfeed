import React from "react";
import AdminInput from "../components/AdminInput";
import Requests from "../common/requests";
import {ADMIN_URLS} from "../../common-src/StringUtils";

function extractErrorMessage(error, fallback) {
  const errors = error?.response?.data?.errors;
  if (errors && errors.length > 0) {
    return errors[0].message;
  }
  return fallback;
}

export default class TagManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tags: [],
      loading: true,
      newTagName: "",
      createError: null,
      creating: false,
      editingId: null,
      editingName: "",
      editError: null,
    };

    this.onNewTagNameChange = this.onNewTagNameChange.bind(this);
    this.onAddTag = this.onAddTag.bind(this);
    this.onStartEdit = this.onStartEdit.bind(this);
    this.onCancelEdit = this.onCancelEdit.bind(this);
    this.onEditingNameChange = this.onEditingNameChange.bind(this);
    this.onSaveEdit = this.onSaveEdit.bind(this);
    this.onDeleteTag = this.onDeleteTag.bind(this);
  }

  componentDidMount() {
    this.loadTags();
  }

  loadTags() {
    return Requests.axiosGet(ADMIN_URLS.ajaxTags())
      .then((res) => {
        this.setState({tags: res.data.tags || [], loading: false});
      })
      .catch(() => {
        this.setState({loading: false});
      });
  }

  onNewTagNameChange(e) {
    this.setState({newTagName: e.target.value, createError: null});
  }

  onAddTag() {
    const name = this.state.newTagName.trim();
    if (!name) {
      return;
    }
    this.setState({creating: true, createError: null});
    Requests.axiosPost(ADMIN_URLS.ajaxTags(), {name})
      .then((res) => {
        this.setState((prevState) => ({
          tags: [...prevState.tags, res.data.tag],
          newTagName: "",
          creating: false,
          createError: null,
        }));
      })
      .catch((error) => {
        this.setState({
          creating: false,
          createError: extractErrorMessage(error, "Failed to create tag"),
        });
      });
  }

  onStartEdit(tag) {
    this.setState({editingId: tag.id, editingName: tag.name, editError: null});
  }

  onCancelEdit() {
    this.setState({editingId: null, editingName: "", editError: null});
  }

  onEditingNameChange(e) {
    this.setState({editingName: e.target.value});
  }

  onSaveEdit(tagId) {
    const name = this.state.editingName.trim();
    if (!name) {
      return;
    }
    Requests.axiosPut(ADMIN_URLS.ajaxTag(tagId), {name})
      .then((res) => {
        this.setState((prevState) => ({
          tags: prevState.tags.map((tag) => (tag.id === tagId ? res.data.tag : tag)),
          editingId: null,
          editingName: "",
          editError: null,
        }));
      })
      .catch((error) => {
        this.setState({editError: extractErrorMessage(error, "Failed to rename tag")});
      });
  }

  onDeleteTag(tagId) {
    if (!window.confirm("Delete this tag?")) {
      return;
    }
    Requests.axiosDelete(ADMIN_URLS.ajaxTag(tagId))
      .then(() => {
        this.setState((prevState) => ({
          tags: prevState.tags.filter((tag) => tag.id !== tagId),
        }));
      })
      .catch(() => {
        // Keep the row on failure; nothing to surface for now.
      });
  }

  renderRow(tag) {
    const {editingId, editingName, editError} = this.state;
    if (editingId === tag.id) {
      return (<li key={tag.id} className="flex items-center justify-between py-3 px-4 border-b border-gray-100 gap-3">
        <div className="flex-1">
          <AdminInput
            value={editingName}
            onChange={this.onEditingNameChange}
            customClass="text-sm px-3 py-1.5"
          />
          {editError && <div className="text-xs text-red-600 mt-1">{editError}</div>}
        </div>
        <div className="flex-none flex gap-2">
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-md bg-brand-light text-white hover:opacity-90"
            onClick={() => this.onSaveEdit(tag.id)}
          >
            Save
          </button>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
            onClick={this.onCancelEdit}
          >
            Cancel
          </button>
        </div>
      </li>);
    }

    return (<li key={tag.id} className="flex items-center justify-between py-3 px-4 border-b border-gray-100 gap-3">
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-900">{tag.name}</div>
        <div className="text-xs text-helper-color">{tag.slug}</div>
      </div>
      <div className="flex-none flex gap-2">
        <button
          type="button"
          aria-label={`Edit ${tag.name}`}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
          onClick={() => this.onStartEdit(tag)}
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${tag.name}`}
          className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
          onClick={() => this.onDeleteTag(tag.id)}
        >
          Delete
        </button>
      </div>
    </li>);
  }

  render() {
    const {tags, loading, newTagName, createError, creating} = this.state;

    return (<div className="grid grid-cols-1 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="lh-page-subtitle mb-2">Add a tag</div>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <AdminInput
              value={newTagName}
              onChange={this.onNewTagNameChange}
              placeholder="New tag name"
            />
            {createError && <div className="text-xs text-red-600 mt-1">{createError}</div>}
          </div>
          <button
            type="button"
            disabled={creating}
            className="flex-none text-sm px-4 py-2 rounded-md bg-brand-light text-white hover:opacity-90 disabled:opacity-50"
            onClick={this.onAddTag}
          >
            Add tag
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {loading && <div className="p-4 text-sm text-helper-color">Loading tags...</div>}
        {!loading && tags.length === 0 && (
          <div className="p-4 text-sm text-helper-color">No tags yet.</div>
        )}
        {!loading && tags.length > 0 && (
          <ul>
            {tags.map((tag) => this.renderRow(tag))}
          </ul>
        )}
      </div>
    </div>);
  }
}
