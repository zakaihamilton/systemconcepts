import Table from "@/widgets/Table";
import data from "@/data/fontSizes";
import { useTranslations } from "@/util/translations";
import SmartphoneIcon from '@material-ui/icons/Smartphone';
import TabletIcon from '@material-ui/icons/Tablet';
import DesktopMacIcon from '@material-ui/icons/DesktopMac';
import Label from "@/widgets/Label";

export default function Languages() {
    const translations = useTranslations();

    const columns = [
        {
            id: "name",
            title: translations.NAME,
            sortable: true
        },
        {
            id: "id",
            title: translations.FONT_SIZE,
            sortable: true
        },
        {
            id: "devicesWidget",
            title: translations.DEVICES,
            sortable: "devices"
        }
    ];

    const deviceTypes = [
        {
            id: "phone",
            name: translations.MOBILE,
            icon: <SmartphoneIcon />
        },
        {
            id: "tablet",
            name: translations.TABLET,
            icon: <TabletIcon />
        },
        {
            id: "desktop",
            name: translations.DESKTOP,
            icon: <DesktopMacIcon />
        }
    ];

    const items = data.map(item => {
        let { devices } = item;

        const deviceItems = deviceTypes.filter(item => devices.includes(item.id));
        return {
            ...item,
            name: translations[item.name],
            devices: deviceItems.map(device => device.name).join(", "), devicesWidget: deviceItems.map(device => {
                return <Label key={device.id} icon={device.icon} name={device.name} />;
            })
        };
    });

    return <>
        <Table sortColumn="id" columns={columns} items={items} />
    </>;
}
