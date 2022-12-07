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
import {NAV_ITEMS, NAV_ITEMS_DICT, OUR_BRAND} from "../../../common-src/Constants";

function NavItem({url, title, navId, currentId, Icon, disabled}) {
  return (
    <a
      href={disabled ? '#' : url}
      className={clsx(disabled ?
        'text-muted-color cursor-not-allowed hover:text-muted-color' :
        'text-white hover:text-brand-light')}
    >
      <div
        className={clsx('py-4 px-4 xl:px-8 flex items-center',
        navId === currentId ? 'font-semibold bg-brand-light hover:text-white hover:opacity-80' : '')}
      >
        {Icon && <div className="mr-2">
          <Icon className="w-3 xl:w-5" />
        </div>}
        <div className="text-sm xl:text-xl">
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
    const onboardingResult = this.props.onboardingResult || {requiredOk: true};
    return (<div className="flex flex-col min-h-screen min-w-screen">
      <div className="grid grid-cols-12 gap-4 bg-white flex items-center border-b drop-shadow">
        <div className="col-span-2 py-4 xl:py-6 px-4 xl:px-8">
          <a href={OUR_BRAND.whatsnewWebsite} target="_blank" className="hover:opacity-50">
            <img src="/assets/brands/microfeed/horizontal-logo.png" className="w-full"/>
          </a>
        </div>
        <div className="col-span-10 flex items-center">
          {upperLevel && <div className="py-6 pl-4 xl:pl-16">
            <a href={upperLevel.url}><span className="lh-icon-arrow-left"/> {upperLevel.name}</a>
            <span className="mx-2">/</span>
            <span className="text-muted-color">{upperLevel.childName}</span>
          </div>}
          {AccessoryComponent && <div>{AccessoryComponent}</div>}
          <div className="flex-1 text-right py-6 px-4 xl:px-16">
            <a href={ADMIN_URLS.logout()} className="hover:opacity-50 text-brand-dark font-semibold text-sm">
              <div className="flex items-center justify-end">
                <div className="mr-1"><ArrowLeftOnRectangleIcon className="w-4"/></div>
                <div>Logout</div>
              </div>
            </a>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4 flex-1">
        <div className="col-span-2 bg-brand-dark flex-none">
          <nav className="py-8">
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
              disabled={!onboardingResult.requiredOk}
            />
            <NavItem
              url={ADMIN_URLS.newItem()}
              title={NAV_ITEMS_DICT[NAV_ITEMS.NEW_ITEM].name}
              navId={NAV_ITEMS.NEW_ITEM}
              currentId={currentPage}
              Icon={PlusIcon}
              disabled={!onboardingResult.requiredOk}
            />
            <NavItem
              url={ADMIN_URLS.allItems()}
              title={NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name}
              navId={NAV_ITEMS.ALL_ITEMS}
              currentId={currentPage}
              Icon={ListBulletIcon}
              disabled={!onboardingResult.requiredOk}
            />
            <NavItem
              url={ADMIN_URLS.settings()}
              title={NAV_ITEMS_DICT[NAV_ITEMS.SETTINGS].name}
              navId={NAV_ITEMS.SETTINGS}
              currentId={currentPage}
              Icon={Cog6ToothIcon}
              disabled={!onboardingResult.requiredOk}
            />
          </nav>
        </div>
        <div className="col-span-10 w-full">
          <div className="py-8 px-4 xl:px-16">
            {this.props.children}
          </div>
        </div>
      </div>
      <ToastContainer
        newestOnTop
      />
    </div>);
  }
}
