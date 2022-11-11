import React from 'react';
import clsx from 'clsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  Cog6ToothIcon,
  PlusIcon,
  ListBulletIcon,
  PencilSquareIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline';
import {ADMIN_URLS} from "../../../common-src/StringUtils";

function NavItem({url, title, navId, currentId, Icon}) {
  return (
    <a
      href={url}
      className={clsx('text-white')}
    >
      <div
        className={clsx('p-4 hover:text-brand-light flex items-center',
        navId === currentId ? 'font-semibold bg-brand-light hover:text-white hover:opacity-80' : '')}
      >
        {Icon && <div className="mr-2">
          <Icon className="w-5" />
        </div>}
        <div>
          {title}
        </div>
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
          <NavItem
            url="/admin/"
            title="Edit podcast"
            navId="edit_podcast"
            currentId={currentPage}
            Icon={PencilSquareIcon}
          />
          <NavItem
            url="/admin/episodes/new/"
            title="Add new episode"
            navId="new_episode"
            currentId={currentPage}
            Icon={PlusIcon}
          />
          <NavItem
            url="/admin/episodes/"
            title="See all episodes"
            navId="all_episodes"
            currentId={currentPage}
            Icon={ListBulletIcon}
          />
          <NavItem
            url="/admin/settings/"
            title="Settings"
            navId="settings"
            currentId={currentPage}
            Icon={Cog6ToothIcon}
          />
        </nav>
      </div>
      <div className="flex-1">
        <div className="bg-white p-4 flex">
          {upperLevel && <div className="flex-1">
            <a href={upperLevel.url}><span className="lh-icon-arrow-left" /> {upperLevel.name}</a>
            <span className="mx-2">/</span>
            <span className="text-muted-color">{upperLevel.childName}</span>
          </div>}
          <div className="flex-1 text-right">
            <a href={ADMIN_URLS.logout()} className="hover:opacity-50 text-brand-dark font-semibold text-sm">
              <div className="flex items-center justify-end">
                <div className="mr-1"><ArrowLeftOnRectangleIcon className="w-4" /></div>
                <div>Logout</div>
              </div>
            </a>
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
