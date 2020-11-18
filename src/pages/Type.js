import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import Input from "@widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@util/pages";
import { useType } from "@util/types";
import LocalOfferIcon from '@material-ui/icons/LocalOffer';
import languages from "@data/languages";
import { useLanguage } from "@util/language";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import Row from "@widgets/Row";
import Select from '@components/Widgets/Select';
import styles from "./Type.module.scss";
import { MainStore } from "@components/Main";
import { useSize } from "@util/size";

export const TypeStoreDefaults = {
    mode: "",
    select: [],
    counter: 1,
    onDone: null,
    offset: 0
};

export const TypeStore = new Store(TypeStoreDefaults);

export default function Type({ path = "" }) {
    const { showSideBar } = MainStore.useState();
    const { select } = TypeStore.useState();
    const language = useLanguage();
    const translations = useTranslations();
    const [record, loading, setRecord, types] = useType({ id: path });
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);
    const [data, setData] = useState({});
    const ref = useRef();

    useEffect(() => {
        setData(record || {});
    }, [record]);

    const onValidateId = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        else if (!text.match(/^[a-z0-9]+$/i)) {
            error = translations.BAD_ID;
        }
        return error;
    };

    const invalidFields = !data ||
        onValidateId(data.id);
    const isInvalid = validate && invalidFields;

    const onSubmit = async () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            setProgress(true);
            await setRecord(data);
            goBackPage();
            setProgress(false);
            setError("");
        }
    };

    const onCancel = () => {
        goBackPage();
    };

    const actions = <>
        <Button
            onClick={onSubmit}
            variant="contained"
            color="primary"
            size="large"
            disabled={!!(isInvalid || inProgress || !data)}
        >
            {translations.SAVE}
        </Button>
        <Button
            onClick={onCancel}
            variant="contained"
            color="primary"
            size="large"
        >
            {translations.CANCEL}
        </Button>
    </>;

    const languageItem = languages.find(item => item.id === language) || {};
    const languageName = languageItem.name;

    const columns = [
        {
            id: "idWidget",
            title: translations.ID,
            sortable: "id"
        },
        {
            id: "label",
            title: translations.NAME,
            sortable: true
        }
    ];

    const typeClick = useCallback(item => {
        const { id } = item;
        console.log("id", id);
        TypeStore.update(s => {
            const select = s.select || [];
            const exists = select.find(item => item.id === id);
            console.log("exists", exists);
            if (exists) {
                s.select = select.filter(item => item.id !== id);
            }
            else {
                s.select = [...select, item];
            }
        });
    }, []);

    const mapper = item => {
        const label = item[language];
        const iconWidget = <Select select={select} item={item} store={TypeStore} />;
        return {
            ...item,
            label,
            idWidget: <Row onClick={typeClick.bind(this, item)} icons={iconWidget}>{item.id}</Row>
        };
    };

    const addType = () => {
        addPath("type/");
    };

    const size = useSize(ref, [showSideBar]);

    return <Form actions={actions} loading={loading || inProgress} data={data} validate={validate}>
        <FormGroup record={data} setRecord={setData}>
            <Input
                id="id"
                label={translations.ID}
                onValidate={onValidateId}
                icon={<LocalOfferIcon />}
            />
            <Input
                id={language}
                label={languageName}
            />
        </FormGroup>
        <div ref={ref} className={styles.table}>
            <Table
                name={data.id}
                data={types}
                loading={loading}
                columns={columns}
                mapper={mapper}
                size={size}
                viewModes={{
                    list: {
                        className: styles.listItem
                    },
                    table: null
                }}
                depends={[select]}
                store={TypeStore}
            />
        </div>
    </Form>;
}
