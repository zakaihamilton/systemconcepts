import Menu from "@/widgets/Menu";
import Button from '@material-ui/core/Button';
import { useTranslations } from "@/util/translations";
import Typography from '@material-ui/core/Typography';

export default function Destination({ state }) {
    const [destination, setDestination] = state;
    const translations = useTranslations();

    const destinationText = destination || translations.DESTINATION;

    const items = [
        {
            id: "Home",
            name: "Home",
            onClick: () => {
                setDestination("/home");
            }
        }
    ];

    return <>
        <Typography>
            {translations.TO}:
        </Typography>
        <Menu selected={destination} items={items}>
            <Button variant="contained" color="primary">
                {destinationText}
            </Button>
        </Menu>
    </>
}