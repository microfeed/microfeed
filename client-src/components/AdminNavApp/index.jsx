import React from 'react';
import clsx from 'clsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function NavItem({url, title, navId, currentId}) {
  return (
    <a
      href={url}
      className={clsx('text-white')}
    >
      <div
        className={clsx('p-4 hover:text-brand-light',
        navId === currentId ? 'font-semibold bg-brand-light hover:text-white hover:opacity-80' : '')}
      >
        {title}
      </div>
    </a>
  );
}

export default class AdminNavApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      'currentPage': props.currentPage || 'edit_podcast',
    }
  }

  componentDidMount() {
  }

  render() {
    const {currentPage} = this.state;
    const {upperLevel} = this.props;
    return (<div className="flex min-h-screen min-w-screen">
      <div className="bg-black flex-none">
        <h1 className="p-4 text-white font-bold text-lg mb-8">
          Admin Dashboard
        </h1>
        <nav>
          <NavItem url="/admin/" title="Edit podcast" navId="edit_podcast" currentId={currentPage} />
          <NavItem url="/admin/episodes/new/" title="Add new episode" navId="new_episode" currentId={currentPage} />
          <NavItem url="/admin/episodes/" title="See all episodes" navId="all_episodes" currentId={currentPage} />
          <NavItem url="/admin/settings/" title="Settings" navId="settings" currentId={currentPage} />
        </nav>
      </div>
      <div className="flex-1">
        <div className="bg-white p-4 flex">
          {upperLevel && <div className="flex-1">
            <a href={upperLevel.url}><span className="lh-icon-arrow-left" /> {upperLevel.name}</a>
          </div>}
          <div className="flex-1 text-right">
            <a href="/admin/logout/" className="hover:opacity-50 text-brand-dark font-semibold text-sm">Logout</a>
          </div>
        </div>
        <div className="p-4">
          {this.props.children}
        </div>
      </div>
      <ToastContainer
        newestOnTop
      />
    </div>);
  }
}
