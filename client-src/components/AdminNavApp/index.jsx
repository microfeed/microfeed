import React from 'react';
import clsx from 'clsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  HomeIcon,
  Cog6ToothIcon,
  PlusIcon,
  ListBulletIcon,
  PencilSquareIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline';
import {ADMIN_URLS} from "../../../common-src/StringUtils";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../../common-src/Constants";

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
      'currentPage': props.currentPage || NAV_ITEMS.ADMIN_HOME,
    }
  }

  componentDidMount() {
  }

  render() {
    const {currentPage} = this.state;
    const {upperLevel, AccessoryComponent} = this.props;
    return (<div className="flex min-h-screen min-w-screen">
      <div className="bg-black flex-none">
        <h1 className="p-4 text-white font-bold text-lg mb-8">
          Admin Dashboard
        </h1>
        <nav>
          <NavItem
            url={ADMIN_URLS.home()}
            title={NAV_ITEMS_DICT[NAV_ITEMS.ADMIN_HOME].name}
            navId={NAV_ITEMS.ADMIN_HOME}
            currentId={currentPage}
            Icon={HomeIcon}
          />
          <NavItem
            url={ADMIN_URLS.editPrimaryChannel()}
            title={NAV_ITEMS_DICT[NAV_ITEMS.EDIT_CHANNEL].name}
            navId={NAV_ITEMS.EDIT_CHANNEL}
            currentId={currentPage}
            Icon={PencilSquareIcon}
          />
          <NavItem
            url={ADMIN_URLS.newItem()}
            title={NAV_ITEMS_DICT[NAV_ITEMS.NEW_ITEM].name}
            navId={NAV_ITEMS.NEW_ITEM}
            currentId={currentPage}
            Icon={PlusIcon}
          />
          <NavItem
            url={ADMIN_URLS.allItems()}
            title={NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name}
            navId={NAV_ITEMS.ALL_ITEMS}
            currentId={currentPage}
            Icon={ListBulletIcon}
          />
          <NavItem
            url={ADMIN_URLS.settings()}
            title={NAV_ITEMS_DICT[NAV_ITEMS.SETTINGS].name}
            navId={NAV_ITEMS.SETTINGS}
            currentId={currentPage}
            Icon={Cog6ToothIcon}
          />
        </nav>
      </div>
      <div className="flex-1">
        <div className="bg-white p-4 flex items-center">
          {upperLevel && <div className="">
            <a href={upperLevel.url}><span className="lh-icon-arrow-left" /> {upperLevel.name}</a>
            <span className="mx-2">/</span>
            <span className="text-muted-color">{upperLevel.childName}</span>
          </div>}
          {AccessoryComponent && <div>{AccessoryComponent}</div>}
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
