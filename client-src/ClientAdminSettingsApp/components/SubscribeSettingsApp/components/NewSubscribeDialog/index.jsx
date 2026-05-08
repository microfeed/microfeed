import React from 'react';
import AdminDialog from "../../../../../components/AdminDialog";
import {PREDEFINED_SUBSCRIBE_METHODS} from '../../../../../../common-src/Constants';
import AdminInput from "../../../../../components/AdminInput";
import {randomShortUUID} from "../../../../../../common-src/StringUtils";
import AdminSelect from "../../../../../components/AdminSelect";
import {isChineseLanguage} from "../../../../../../common-src/I18n";

function getMethodOptions(isZh) {
  return Object.keys(PREDEFINED_SUBSCRIBE_METHODS).map((key) => {
    const m = PREDEFINED_SUBSCRIBE_METHODS[key];
    const labelName = isZh && m.nameZh ? m.nameZh : m.name;
    return {
      value: key,
      label: <div className="flex items-center">
        <div className="flex-none mr-2"><img src={m.image} className="w-4"/></div>
        <div>{labelName}</div>
      </div>,
    };
  });
}

export default class NewSubscribeDialog extends React.Component {
  constructor(props) {
    super(props);

    this.initState = {
      selectedMethod: null,
      name: '',
      url: '',
    };

    this.state = {
      ...this.initState,
    };
  }

  render() {
    const {
      isOpen,
      setIsOpen,
      addNewMethod,
      language,
    } = this.props;
    const {selectedMethod, name, url} = this.state;
    const method = PREDEFINED_SUBSCRIBE_METHODS[selectedMethod];
    const isZh = isChineseLanguage(language);
    const t = (zhText, enText) => isZh ? zhText : enText;
    const methodOptions = getMethodOptions(isZh);

    return (<AdminDialog
      title={t('新增订阅方式', 'Add subscribe method')}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <form>
        <div>
          <AdminSelect
            label={t('请选择订阅方式：', 'Choose a subscribe method:')}
            options={methodOptions}
            onChange={({value}) => {
              const m = PREDEFINED_SUBSCRIBE_METHODS[value];
              this.setState({
                selectedMethod: value,
                name: isZh && m.nameZh ? m.nameZh : m.name,
              });
            }}
          />
        </div>
        {method && <div className="flex mt-4">
          <div className="mr-4 flex items-center">
            <img alt={method.name} src={method.image} className="w-24"/>
          </div>
          <div className="w-full grid grid-cols-1 gap-4">
            <AdminInput
              label={t('名称', 'Name')}
              value={name}
              customLabelClass="m-input-label-small"
              customClass="text-xs"
              onChange={(e) => this.setState({name: e.target.value})}
            />
            <AdminInput
              label={t('链接', 'Url')}
              value={url}
              type="url"
              customLabelClass="m-input-label-small"
              customClass="text-xs"
              onChange={(e) => this.setState({url: e.target.value})}
            />
          </div>
        </div>}
        <div className="pt-8 flex justify-center">
          <button
            className="lh-btn lh-btn-brand-dark"
            disabled={!method}
            onClick={(e) => {
              e.preventDefault();
              addNewMethod({
                ...method,
                name,
                url,
                id: randomShortUUID(),
              });
              setIsOpen(false);
              this.setState({...this.initState});
            }}
          >
            {t('新增订阅方式', 'Add subscribe method')}
          </button>
        </div>
      </form>
    </AdminDialog>);
  }
}
